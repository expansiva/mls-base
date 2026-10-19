import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import { probeBenchHealth } from './health.mjs';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close(() => resolve());
  });
}

test('probe accepts loopback 200 with ok true and sends no cookie or authorization', async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ cookie: req.headers.cookie, authorization: req.headers.authorization, url: req.url });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
  const port = await listen(server);
  try {
    const result = await probeBenchHealth({ port }, { totalMs: 1000, attemptMs: 500, intervalMs: 20 });
    assert.deepEqual(result, { ok: true });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, '/health');
    assert.equal(seen[0].cookie, undefined);
    assert.equal(seen[0].authorization, undefined);
  } finally {
    await close(server);
  }
});

test('probe rejects ok false, html, invalid json and 404 without the response body', async () => {
  const cases = [
    { status: 200, body: JSON.stringify({ ok: false }), type: 'application/json', message: 'health status 200 without ok' },
    { status: 200, body: '<html>no</html>', type: 'text/html', message: 'health status 200 is not json' },
    { status: 200, body: '{', type: 'application/json', message: 'health status 200 is not json' },
    { status: 404, body: 'missing secret body', type: 'text/plain', message: 'health status 404' },
  ];
  for (const item of cases) {
    const server = http.createServer((_req, res) => {
      res.writeHead(item.status, { 'content-type': item.type });
      res.end(item.body);
    });
    const port = await listen(server);
    try {
      const result = await probeBenchHealth({ port }, { totalMs: 800, attemptMs: 400, intervalMs: 20 });
      assert.equal(result.ok, false);
      assert.equal(result.message, item.message);
      assert.equal(JSON.stringify(result).includes('secret'), false);
      assert.equal(JSON.stringify(result).includes('<html>'), false);
    } finally {
      await close(server);
    }
  }
});

test('probe treats a manual redirect as failure and does not touch the other host', async () => {
  let otherHits = 0;
  const other = http.createServer((_req, res) => {
    otherHits += 1;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
  const otherPort = await listen(other);
  const server = http.createServer((_req, res) => {
    res.writeHead(302, { location: `http://127.0.0.1:${otherPort}/asset.js` });
    res.end();
  });
  const port = await listen(server);
  try {
    const result = await probeBenchHealth({ port }, { totalMs: 800, attemptMs: 400, intervalMs: 20 });
    assert.equal(result.ok, false);
    assert.match(result.message, /redirect|status 302/);
    assert.equal(otherHits, 0);
  } finally {
    await close(server);
    await close(other);
  }
});

test('probe retries a transient 503 and then accepts 200', async () => {
  let hits = 0;
  const server = http.createServer((_req, res) => {
    hits += 1;
    if (hits === 1) {
      res.writeHead(503);
      res.end('busy');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
  const port = await listen(server);
  try {
    const result = await probeBenchHealth({ port }, { totalMs: 2000, attemptMs: 400, intervalMs: 30 });
    assert.deepEqual(result, { ok: true });
    assert.equal(hits, 2);
  } finally {
    await close(server);
  }
});

test('probe times out when headers arrive and the body never finishes', async () => {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n');
  });
  const port = await listen(server);
  try {
    const started = Date.now();
    const result = await probeBenchHealth({ port }, { totalMs: 350, attemptMs: 200, intervalMs: 20 });
    const elapsed = Date.now() - started;
    assert.equal(result.ok, false);
    assert.equal(result.message, 'health timed out');
    assert.ok(elapsed < 2000, `elapsed ${elapsed}`);
  } finally {
    for (const socket of sockets) socket.destroy();
    await close(server);
  }
});

test('probe rejects an invalid port without fetching', async () => {
  const result = await probeBenchHealth({ port: 0 }, { totalMs: 50, attemptMs: 20, intervalMs: 10 });
  assert.deepEqual(result, { ok: false, message: 'health port is invalid' });
});
