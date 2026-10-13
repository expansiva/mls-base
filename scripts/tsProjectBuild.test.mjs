import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildTsProjects, parseMaxRss, sourcesForBuild, spawnTscMeasured, statusByMember } from './tsProjectBuild.mjs';

function withRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'ts-project-build-'));
  return Promise.resolve()
    .then(() => run(root))
    .finally(() => rmSync(root, { recursive: true, force: true }));
}

function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function appFixture(root, { app = 'export const n = 1;\n', page = 'export const t = 1;\n' } = {}) {
  write(join(root, 'mls-1', 'l2', 'app.ts'), `import { lib } from '/_2_/l2/lib.js';\nexport const app = lib;\n${app}`);
  write(join(root, 'mls-1', 'l2', 'page.test.ts'), page);
  write(join(root, 'mls-1', 'l5', 'config.json'), JSON.stringify({
    modules: [{ frontend: { pageTests: ['mls-1/l2/page.test.ts', 'mls-2/l2/kept.test.ts'] } }],
  }));
  write(join(root, 'mls-2', 'l2', 'lib.ts'), 'export const lib = 1;\n');
  write(join(root, 'mls-2', 'l2', 'dep.test.ts'), 'export const bad: number = "no";\n');
  write(join(root, 'mls-2', 'l2', 'kept.test.ts'), 'export const kept = 1;\n');
}

test('primeira chamada built, segunda skipped, mudança só no app', async () => {
  await withRoot(async (root) => {
    appFixture(root);
    const args = { root, ids: ['1', '2'], clientId: '1' };
    const first = buildTsProjects(args);
    const s1 = statusByMember(first.nodes);
    assert.equal(s1['2.l2'], 'built');
    assert.equal(s1['1.l2'], 'built');

    const second = buildTsProjects(args);
    const s2 = statusByMember(second.nodes);
    assert.equal(s2['2.l2'], 'skipped');
    assert.equal(s2['1.l2'], 'skipped');

    write(join(root, 'mls-1', 'l2', 'app.ts'), "import { lib } from '/_2_/l2/lib.js';\nexport const app = lib + 1;\n");
    const third = buildTsProjects(args);
    const s3 = statusByMember(third.nodes);
    assert.equal(s3['2.l2'], 'skipped');
    assert.equal(s3['1.l2'], 'built');
  });
});

test('ciclo A↔B vira um nó e os dois pulam juntos', async () => {
  await withRoot(async (root) => {
    write(join(root, 'mls-1', 'l2', 'a.ts'), "import { b } from '/_2_/l2/b.js';\nexport const a = 1;\n");
    write(join(root, 'mls-2', 'l2', 'b.ts'), "import { a } from '/_1_/l2/a.js';\nexport const b = 1;\n");
    const logs = [];
    const args = { root, ids: ['1', '2'], clientId: '1', log: (line) => logs.push(line) };
    const first = buildTsProjects(args);
    assert.equal(first.nodes.length, 1);
    assert.deepEqual(first.nodes[0].members, ['1.l2', '2.l2']);
    assert.equal(first.nodes[0].status, 'built');
    assert.ok(logs.some((line) => line === 'tsbuild scc [1.l2, 2.l2] como um nó'));

    const second = buildTsProjects(args);
    const s2 = statusByMember(second.nodes);
    assert.equal(s2['1.l2'], 'skipped');
    assert.equal(s2['2.l2'], 'skipped');
  });
});

test('.test.ts de dependência fica fora; pageTests entra', async () => {
  await withRoot(async (root) => {
    appFixture(root);
    const { byNode, outside } = sourcesForBuild(root, ['1', '2'], '1', [
      'mls-1/l2/page.test.ts',
      'mls-2/l2/kept.test.ts',
    ]);
    const dep = byNode.get('2.l2').map((f) => f.split('/').pop());
    const app = byNode.get('1.l2').map((f) => f.split('/').pop());
    assert.deepEqual(dep.sort(), ['kept.test.ts', 'lib.ts']);
    assert.ok(app.includes('page.test.ts'));
    assert.ok(app.includes('app.ts'));
    assert.equal(app.includes('dep.test.ts'), false);
    assert.deepEqual(outside, ['mls-2/l2/kept.test.ts']);

    const built = buildTsProjects({ root, ids: ['1', '2'], clientId: '1' });
    const cfg = JSON.parse(readFileSync(join(root, '.tsbuild', '2.l2', 'tsconfig.json'), 'utf8'));
    const listed = cfg.files.join('\n');
    assert.equal(listed.includes('dep.test.ts'), false);
    assert.equal(listed.includes('kept.test.ts'), true);
    assert.equal(cfg.compilerOptions.composite, true);
    assert.equal(cfg.compilerOptions.declaration, true);
    assert.equal(built.nodes.every((n) => n.status === 'built'), true);
  });
});

test('erro de tipo no app vira errors com o resumo', async () => {
  await withRoot(async (root) => {
    appFixture(root, { app: 'export const n: number = "x";\n' });
    const result = buildTsProjects({ root, ids: ['1', '2'], clientId: '1' });
    const app = result.nodes.find((n) => n.members.includes('1.l2'));
    assert.equal(app.status, 'errors');
    const lines = [...app.summary.l1.lines, ...app.summary.l2.lines, ...app.summary.other.lines];
    assert.ok(lines.length >= 1);
    assert.equal(app.verdicts['1'].block, false);
  });
});

const MAC_TIME_L = `        0.00 real         0.00 user         0.00 sys
             1179648  maximum resident set size
                   0  average shared memory size
                   0  average unshared data size
                   0  average unshared stack size
                 213  page reclaims
                   0  page faults
                   0  swaps
                   0  block input operations
                   0  block output operations
                   0  messages sent
                   0  messages received
                   0  signals received
                   0  voluntary context switches
                   7  involuntary context switches
            11157272  instructions retired
             4839313  cycles elapsed
              868544  peak memory footprint
`;

const LINUX_TIME_V = `	Command being timed: "true"
	User time (seconds): 0.00
	System time (seconds): 0.00
	Percent of CPU this job got: 0%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:00.00
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 896
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 1
	Minor (reclaiming a frame) page faults: 66
	Voluntary context switches: 4
	Involuntary context switches: 0
	Swaps: 0
	File system inputs: 392
	File system outputs: 0
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
`;

test('parseMaxRss lê os bytes do time -l no macOS', () => {
  assert.equal(parseMaxRss(MAC_TIME_L, 'darwin'), 1179648);
});

test('parseMaxRss lê os kbytes do time -v no Linux', () => {
  assert.equal(parseMaxRss(LINUX_TIME_V, 'linux'), 896 * 1024);
});

test('medidor que sai 125 cai no tsc sem medidor', () => {
  const calls = [];
  const spawn = (cmd, args) => {
    calls.push(cmd);
    if (cmd === '/usr/bin/time') {
      return { status: 125, signal: null, stdout: '', stderr: "/usr/bin/time: invalid option -- 'l'\n" };
    }
    return {
      status: 0,
      signal: null,
      stdout: '12:00:00 AM - Projects in this build: \n    * tsconfig.json\n',
      stderr: '',
    };
  };
  const lines = [];
  const orig = console.log;
  console.log = (line) => { lines.push(String(line)); };
  try {
    const result = spawnTscMeasured('/tmp', '/tmp/tsconfig.json', spawn, 'darwin');
    assert.equal(result.status, 0);
    assert.equal(result.rssBytes, 0);
    assert.deepEqual(calls, ['/usr/bin/time', process.execPath]);
    assert.equal(lines[0], "tsbuild: medidor de memória indisponível (/usr/bin/time: invalid option -- 'l')");
    assert.match(result.output, /Projects in this build/);
  } finally {
    console.log = orig;
  }
});
