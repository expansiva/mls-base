import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTsCompiler, runTsCompiler } from './tsCompiler.mjs';

function withRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'ts-compiler-'));
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeBin(root, name, body) {
  const binDir = join(root, 'node_modules', '.bin');
  mkdirSync(binDir, { recursive: true });
  const file = join(binDir, name);
  writeFileSync(file, `#!/usr/bin/env node\n${body}\n`);
  chmodSync(file, 0o755);
  return file;
}

function walkMjs(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walkMjs(path, out);
    else if (name.endsWith('.mjs') && name !== 'tsCompiler.mjs') out.push(path);
  }
  return out;
}

test('COLLAB_TS_COMPILER=tsc selects tsc even when tsrs answers -v', () => {
  withRoot((root) => {
    writeBin(root, 'tsrs', "if (process.argv[2] === '-v') { console.log('tsrs 7.1.0-beta.tsrs3'); process.exit(0); } process.exit(9);");
    writeBin(root, 'tsc', "process.exit(0);");
    const choice = resolveTsCompiler(root, { COLLAB_TS_COMPILER: 'tsc' });
    assert.equal(choice.name, 'tsc');
    assert.match(choice.bin, /node_modules\/\.bin\/tsc$/);
  });
});

test('default is tsrs when the binary answers -v', () => {
  withRoot((root) => {
    writeBin(root, 'tsrs', "if (process.argv[2] === '-v') { console.log('tsrs 7.1.0-beta.tsrs3'); process.exit(0); } process.exit(9);");
    writeBin(root, 'tsc', "process.exit(0);");
    const choice = resolveTsCompiler(root, {});
    assert.equal(choice.name, 'tsrs');
    assert.equal(choice.version, 'tsrs 7.1.0-beta.tsrs3');
  });
});

test('missing tsrs selects tsc and the log says why', () => {
  withRoot((root) => {
    writeBin(root, 'tsc', "process.exit(0);");
    const lines = [];
    const choice = resolveTsCompiler(root, {});
    assert.equal(choice.name, 'tsc');
    const result = runTsCompiler(['-p', 'tsconfig.json'], {
      root,
      env: {},
      log: (line) => lines.push(line),
    });
    assert.equal(result.status, 0);
    assert.equal(result.fellBack, false);
    assert.match(lines.join('\n'), /using tsc/);
    assert.match(lines.join('\n'), /tsrs binary is missing or -v failed/);
  });
});

test('tsrs death runs tsc once and logs the fallback', () => {
  withRoot((root) => {
    writeBin(root, 'tsrs', `if (process.argv[2] === '-v') { console.log('tsrs 7.1.0-beta.tsrs3'); process.exit(0); }
process.kill(process.pid, 'SIGKILL');`);
    writeBin(root, 'tsc', "console.log('tsc-ran'); process.exit(0);");
    const lines = [];
    const result = runTsCompiler(['-p', 'tsconfig.json'], {
      root,
      env: {},
      log: (line) => lines.push(line),
    });
    assert.equal(result.fellBack, true);
    assert.equal(result.compiler.name, 'tsc');
    assert.match(`${result.stdout}`, /tsc-ran/);
    assert.match(lines.join('\n'), /running the same step once with tsc/);
  });
});

test('a tsrs type error does not fall back to tsc', () => {
  withRoot((root) => {
    writeBin(root, 'tsrs', `if (process.argv[2] === '-v') { console.log('tsrs 7.1.0-beta.tsrs3'); process.exit(0); }
console.log('a.ts(1,1): error TS2322: bad');
process.exit(2);`);
    writeBin(root, 'tsc', "console.log('tsc-ran'); process.exit(0);");
    const result = runTsCompiler(['-p', 'tsconfig.json'], { root, env: {}, log: () => {} });
    assert.equal(result.fellBack, false);
    assert.equal(result.compiler.name, 'tsrs');
    assert.equal(result.status, 2);
    assert.doesNotMatch(`${result.stdout}`, /tsc-ran/);
  });
});

test('null exit from tsrs falls back once', () => {
  withRoot((root) => {
    writeBin(root, 'tsrs', 'process.exit(0);');
    let runs = 0;
    const result = runTsCompiler(['-p', 'x'], {
      root,
      env: { COLLAB_TS_COMPILER: 'tsrs' },
      log: () => {},
      spawn: (bin, args) => {
        if (args[0] === '-v') {
          return { status: 0, signal: null, error: undefined, stdout: 'tsrs 7.1.0-beta.tsrs3\n', stderr: '' };
        }
        runs += 1;
        if (String(bin).endsWith('tsrs')) {
          return { status: null, signal: null, error: undefined, stdout: '', stderr: '' };
        }
        return { status: 0, signal: null, error: undefined, stdout: 'tsc-ran\n', stderr: '' };
      },
    });
    assert.equal(runs, 2);
    assert.equal(result.fellBack, true);
    assert.match(`${result.stdout}`, /tsc-ran/);
  });
});

test('the callers (emitProject, buildCI compile, typeCheckRun) do not name a tsc binary outside tsCompiler.mjs', () => {
  const scripts = join(import.meta.dirname, '.');
  const hits = [];
  for (const file of walkMjs(scripts)) {
    const text = readFileSync(file, 'utf8');
    const shim = 'node_modules/.bin/' + 'tsc';
    const lib = 'typescript/' + 'bin/tsc';
    if (text.includes(shim) || text.includes(lib)) hits.push(file);
  }
  assert.deepEqual(hits, []);
  for (const file of ['emitProject.mjs', 'buildCI/compile.mjs', 'typeCheckRun.mjs']) {
    const text = readFileSync(join(scripts, file), 'utf8');
    assert.match(text, /tsCompiler\.mjs/);
  }
});
