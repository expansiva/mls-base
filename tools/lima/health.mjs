/**
 * Sondagem HTTP limitada do /health da bancada. Não segue redirect nem lê release.
 */
const DEFAULT_TOTAL_MS = 30_000;
const DEFAULT_ATTEMPT_MS = 2_000;
const DEFAULT_INTERVAL_MS = 250;

export async function probeBenchHealth({ port } = {}, options = {}) {
  const totalMs = finiteOr(options.totalMs, DEFAULT_TOTAL_MS);
  const attemptMs = finiteOr(options.attemptMs, DEFAULT_ATTEMPT_MS);
  const intervalMs = finiteOr(options.intervalMs, DEFAULT_INTERVAL_MS);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const numeric = typeof port === 'number' ? port : Number(port);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65535) {
    return { ok: false, message: 'health port is invalid' };
  }

  const url = `http://127.0.0.1:${numeric}/health`;
  const deadline = Date.now() + Math.max(0, totalMs);
  let last = { ok: false, message: 'health timed out' };
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const outcome = await attemptHealth(fetchImpl, url, Math.min(attemptMs, remaining));
    if (outcome.definitive) return outcome.result;
    last = outcome.result;
    const pause = Math.min(intervalMs, deadline - Date.now());
    if (pause <= 0) break;
    await wait(pause);
  }
  return last;
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

async function attemptHealth(fetchImpl, url, budgetMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    const status = response.status;
    if (response.type === 'opaqueredirect' || (status >= 300 && status < 400)) {
      await discard(response);
      return done(false, status >= 300 && status < 400 ? `health status ${status}` : 'health redirect');
    }
    if (status === 503) {
      await discard(response);
      return retry(false, 'health status 503');
    }
    if (status === 404) {
      await discard(response);
      return done(false, 'health status 404');
    }
    if (status !== 200) {
      await discard(response);
      return done(false, `health status ${status}`);
    }
    const text = await readLimited(response, controller.signal);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return done(false, 'health status 200 is not json');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.ok !== true) {
      return done(false, 'health status 200 without ok');
    }
    return done(true);
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      return retry(false, 'health timed out');
    }
    return retry(false, 'health connection failed');
  } finally {
    clearTimeout(timer);
  }
}

function done(ok, message) {
  return { definitive: true, result: ok ? { ok: true } : { ok: false, message } };
}

function retry(ok, message) {
  return { definitive: false, result: { ok, message } };
}

async function readLimited(response, signal) {
  if (signal.aborted) {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  }
  return response.text();
}

async function discard(response) {
  const body = response?.body;
  if (body && typeof body.cancel === 'function') {
    await body.cancel().catch(() => {});
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}
