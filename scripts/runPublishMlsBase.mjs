#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publishScript = resolve(ROOT, 'scripts/publish/publishMlsBase.py');
const passthroughArgs = process.argv.slice(2);

const candidates = process.platform === 'win32'
  ? [
      { command: 'py', args: ['-3'] },
      { command: 'python', args: [] },
      { command: 'python3', args: [] },
    ]
  : [
      { command: 'python3', args: [] },
      { command: 'python', args: [] },
    ];

let lastError;
for (const candidate of candidates) {
  const result = spawnSync(candidate.command, [...candidate.args, publishScript, ...passthroughArgs], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error?.code === 'ENOENT') {
    lastError = result.error;
    continue;
  }

  if (result.error) {
    console.error(`[publish] failed to start ${candidate.command}: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

console.error('[publish] Python 3 was not found. Install Python 3 or add it to PATH.');
if (lastError) console.error(`[publish] last error: ${lastError.message}`);
process.exit(1);
