// Release compile timings. One JSON line per stage when COLLAB_BUILD_TIMINGS_FILE is set.
// A write failure is logged and ignored: measuring must not fail the build.

import { appendFileSync } from 'node:fs';

export function recordStage(stage) {
  const file = process.env.COLLAB_BUILD_TIMINGS_FILE;
  if (!file) return;
  try {
    appendFileSync(file, `${JSON.stringify(stage)}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[build] timings not written: ${message}`);
  }
}

export function timeStage(nome, fn, extra) {
  const start = performance.now();
  const finish = () => {
    recordStage({
      nome,
      duracaoMs: Math.round(performance.now() - start),
      ...(extra ?? {}),
    });
  };
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(
        (value) => {
          finish();
          return value;
        },
        (err) => {
          finish();
          throw err;
        },
      );
    }
    finish();
    return result;
  } catch (err) {
    finish();
    throw err;
  }
}
