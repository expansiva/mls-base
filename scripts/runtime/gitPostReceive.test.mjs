import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clientIdForRelease,
  compileFecho,
  evaluateBuild,
  fechoCompileVerdict,
  fechoMissingMessage,
  firstTscExcerpt,
  formatErrorOutput,
  formatOkMarker,
  gateMessage,
  parseBuildObjSummary,
  planFechoCompile,
  trackedDirtyPaths, authorNote,
  restoreWorktree, shouldDeferPm2Reload, scheduleDetachedPm2Reload, pm2ConfigRel,
  reloadPm2Now, staleClusterWorkers, formatStaleWorkerLog, parsePm2Jlist,
  reportClientConfig,
  ensureTsconfigPaths,
} from './gitPostReceive.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const CODE_ERR = 'code.ts(1,1): error TS2307: Cannot find module \'foo\'.';
const CODE_ERR_2 = 'code.ts(2,1): error TS2307: Cannot find module \'bar\'.';
const CODE_ERR_3 = 'code.ts(3,1): error TS2307: Cannot find module \'baz\'.';
const DECL_ERR = 'decl.ts(1,1): error TS2792: Cannot find module \'lit\'.';

function twoPassOutput({ codeErrors, declErrors, codeLines, declLines }) {
  const codeBlock = (codeLines ?? []).join('\n');
  const declBlock = (declLines ?? []).join('\n');
  return [
    '[buildCI:compile] tsc -p tsconfig.json (code)',
    codeBlock && `[buildCI:compile] WARNING: tsc (code) reported type error(s) (exit 2) — best-effort:\n${codeBlock}`,
    `[buildCI:compile] ##buildCI pass=code errors=${codeErrors}##`,
    '[buildCI:compile] tsc -p tsconfig.d.json (declarations)',
    declBlock && `[buildCI:compile] WARNING: tsc (declarations) reported type error(s) (exit 2) — best-effort:\n${declBlock}`,
    `[buildCI:compile] ##buildCI pass=declarations errors=${declErrors}##`,
  ].filter(Boolean).join('\n');
}

test('pass=code errors=0 + declarations errors=208 => build=ok with declWarn=208', () => {
  const out = twoPassOutput({
    codeErrors: 0,
    declErrors: 208,
    declLines: [DECL_ERR],
  });
  const verdict = evaluateBuild(0, out);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.gate, 'pass=code');
  assert.equal(verdict.declWarn, 208);
  const marker = formatOkMarker('mls-102047', '20260902120000', verdict.declWarn);
  assert.equal(marker, '##gitBackend build=ok release=20260902120000 project=mls-102047## declWarn=208');
  assert.match(gateMessage(verdict), /gate=pass=code/);
  // Neighbour: publishGit.mjs MARKER_OK (do not touch that file).
  const MARKER_OK = /##gitBackend build=ok release=(\d{14}) project=mls-\d+##/;
  assert.equal(MARKER_OK.test(marker), true);
  assert.equal(MARKER_OK.exec(marker)[1], '20260902120000');
});

test('pass=code errors=3 => build=error and excerpt is from the code pass', () => {
  const out = twoPassOutput({
    codeErrors: 3,
    declErrors: 208,
    codeLines: [CODE_ERR, CODE_ERR_2, CODE_ERR_3],
    declLines: [DECL_ERR],
  });
  const verdict = evaluateBuild(0, out);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gate, 'pass=code');
  const printed = formatErrorOutput('mls-102047', verdict);
  assert.match(printed, /##gitBackend build=error project=mls-102047##/);
  assert.match(printed, /error TS2307: Cannot find module 'foo'/);
  assert.doesNotMatch(printed, /error TS2792/);
  assert.doesNotMatch(printed, /Cannot find module 'lit'/);
  const excerpt = firstTscExcerpt(verdict.excerptText);
  assert.match(excerpt, /error TS2307/);
  assert.doesNotMatch(excerpt, /error TS2792/);
});

test('build.code !== 0 => build=error independent of pass markers', () => {
  const out = twoPassOutput({ codeErrors: 0, declErrors: 0 });
  const verdict = evaluateBuild(1, out);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gate, 'exit');
  const printed = formatErrorOutput('mls-102047', verdict);
  assert.match(printed, /gate=exit \(build\.code!=0\)/);
  assert.match(printed, /##gitBackend build=error project=mls-102047##/);
});

test('output without pass marker falls back to scanning everything and says so', () => {
  const out = [
    '[buildCI:compile] WARNING: tsc (declarations) reported type error(s)',
    DECL_ERR,
  ].join('\n');
  const verdict = evaluateBuild(0, out);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gate, 'fallback');
  const printed = formatErrorOutput('mls-102047', verdict);
  assert.match(printed, /gate=fallback \(no ##buildCI pass=code## marker\)/);
  assert.match(printed, /##gitBackend build=error project=mls-102047##/);
  assert.match(printed, /error TS2792/);
});

test('fallback with no tsc errors at all is build=ok', () => {
  const verdict = evaluateBuild(0, '[buildProjectsObj] summary: built [102047]');
  assert.equal(verdict.ok, true);
  assert.equal(verdict.gate, 'fallback');
  assert.match(gateMessage(verdict), /gate=fallback/);
});

test('typeCheck marker + type errors + permissive is build=ok even if pass=code counted them', () => {
  const marker = '##typeCheck project=102025 status=permissive l1.type=0 l1.blocking=0 l2.type=1 l2.blocking=0##';
  const out = [
    twoPassOutput({
      codeErrors: 1,
      declErrors: 0,
      codeLines: ['mls-102025/l2/x.ts(1,1): error TS2345: \'"LoadMonaco"\' is not assignable to \'TypeEvent\'.'],
    }),
    marker,
  ].join('\n');
  const verdict = evaluateBuild(0, out);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.gate, 'typeCheck');
  assert.equal(verdict.typeWarn, 1);
  assert.match(gateMessage(verdict), /gate=typeCheck status=permissive/);
});

test('typeCheck marker + strict + type errors is build=error', () => {
  const marker = '##typeCheck project=102025 status=strict l1.type=0 l1.blocking=0 l2.type=1 l2.blocking=0##';
  const verdict = evaluateBuild(0, marker);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gate, 'typeCheck');
  const printed = formatErrorOutput('mls-102025', verdict);
  assert.match(printed, /##gitBackend build=error project=mls-102025##/);
});

test('typeCheck marker + blocking import is build=error even when permissive', () => {
  const marker = '##typeCheck project=102025 status=permissive l1.type=0 l1.blocking=0 l2.type=0 l2.blocking=1##';
  const verdict = evaluateBuild(0, marker);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gate, 'typeCheck');
  assert.deepEqual(verdict.blocked, ['102025']);
  const printed = formatErrorOutput('mls-102025', verdict);
  assert.match(printed, /gate=typeCheck blocked projects=102025/);
  assert.doesNotMatch(printed, /status=permissive/);
  assert.match(printed, /##gitBackend build=error project=mls-102025##/);
});

test('typeCheck blocking names every blocked project, never status=permissive', () => {
  const out = [
    '##typeCheck project=102056 status=permissive l1.type=0 l1.blocking=1 l2.type=0 l2.blocking=0##',
    '##typeCheck project=102025 status=permissive l1.type=0 l1.blocking=0 l2.type=0 l2.blocking=1##',
  ].join('\n');
  const verdict = evaluateBuild(0, out);
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.blocked, ['102056', '102025']);
  assert.match(gateMessage(verdict), /blocked projects=102056,102025/);
  assert.doesNotMatch(gateMessage(verdict), /status=permissive/);
});

test('ensureTsconfigPaths gera tsconfig.vm.json e não suja o versionado (T1 T5)', () => {
  const src = readFileSync(join(HERE, 'gitPostReceive.mjs'), 'utf8');
  assert.match(
    src,
    /reportClientConfig\(root, id\);\s*ensureTsconfigPaths\(root\);/,
    'paths sync runs in main() after clientConfig and before the compile loop',
  );
  assert.doesNotMatch(src, /addMissingTsconfigPaths\(/);
  assert.match(src, /writeVmTsconfig/);
  assert.match(
    readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8'),
    /^tsconfig\.vm\.json$/m,
  );

  const root = mkdtempSync(join(tmpdir(), 'hook-paths-'));
  const git = (args, extra = {}) => {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', ...extra });
    return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
  };
  try {
    const versioned = `{
    "compilerOptions": {
        "paths": {
            "/_102039_/*": ["./mls-102039/*"]
        }
    }
}
`;
    writeFileSync(join(root, 'tsconfig.json'), versioned);
    writeFileSync(join(root, '.gitignore'), 'tsconfig.vm.json\nmls-*\n');
    mkdirSync(join(root, 'mls-102056', 'l5'), { recursive: true });
    writeFileSync(join(root, 'mls-102056', 'l5', 'config.json'), '{}\n');
    git(['init', '-q']);
    git(['add', 'tsconfig.json', '.gitignore']);
    const committed = spawnSync(
      'git',
      ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init'],
      { encoding: 'utf8' },
    );
    assert.equal(committed.status, 0, `${committed.stdout ?? ''}${committed.stderr ?? ''}`);

    const lines = [];
    assert.deepEqual(ensureTsconfigPaths(root, (text) => lines.push(text)), ['102056']);
    assert.match(lines.join(''), /tsconfig\.vm\.json/);
    assert.match(lines.join(''), /setup mapping, not an agent error/);
    assert.equal(readFileSync(join(root, 'tsconfig.json'), 'utf8'), versioned);
    assert.match(readFileSync(join(root, 'tsconfig.vm.json'), 'utf8'), /"\/_102056_\/\*"/);
    assert.equal(git(['status', '--short']).out, '');
    assert.equal(git(['ls-files', 'tsconfig.vm.json']).out, '');
    assert.equal(existsSync(join(root, 'tsconfig.vm.json')), true);
    assert.deepEqual(ensureTsconfigPaths(root, (text) => lines.push(text)), []);
    assert.equal(git(['status', '--short']).out, '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('up-to-date obj (no pass=code dump) still gates from the typeCheck marker', () => {
  const marker = '##typeCheck project=102025 status=permissive l1.type=0 l1.blocking=0 l2.type=1 l2.blocking=0##';
  const out = `[buildProjectsObj] summary: built [-] | up-to-date [102025] | failed [-]\n${marker}`;
  const verdict = evaluateBuild(0, out);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.typeWarn, 1);
});

test('declWarn=0 keeps the exact gb3 ok marker', () => {
  assert.equal(
    formatOkMarker('mls-102047', '20260902120000', 0),
    '##gitBackend build=ok release=20260902120000 project=mls-102047##',
  );
});

test('trackedDirtyPaths: only tracked changes block the next push (D-A2)', () => {
  const porcelain = [
    ' M l5/config.json',
    '?? l5/novo.json',
    'R  antigo.ts -> novo.ts',
    'M  l2/project.ts',
    '',
  ].join('\n');
  assert.deepEqual(trackedDirtyPaths(porcelain), ['l5/config.json', 'novo.ts', 'l2/project.ts']);
  assert.deepEqual(trackedDirtyPaths(''), []);
  assert.deepEqual(trackedDirtyPaths('?? só/untracked'), []);
});

// ── gb15: numa VM com N projetos, quem manda é o projeto EMPURRADO ──────────
function withVm(fn) {
  const root = mkdtempSync(join(tmpdir(), 'hook-vm-'));
  const writeConfig = (path, client) => {
    mkdirSync(join(root, ...path.slice(0, -1)), { recursive: true });
    writeFileSync(
      join(root, ...path),
      JSON.stringify({ projects: { '102033': { type: 'master frontend' }, [client]: { type: 'client' } } }),
    );
  };
  try {
    return fn(root, writeConfig);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('o cliente da release é o projeto empurrado, não o config.json do root', () => {
  withVm((root, writeConfig) => {
    writeConfig(['config.json'], '102043');           // root: do último publish
    writeConfig(['mls-102047', 'l5', 'config.json'], '102047');
    assert.deepEqual(clientIdForRelease(root, '102047'), { clientId: '102047', ownClient: true });
  });
});

test('push de plataforma (sem l5/config próprio) cai no cliente do root', () => {
  withVm((root, writeConfig) => {
    writeConfig(['config.json'], '102043');
    assert.deepEqual(clientIdForRelease(root, '102020'), { clientId: '102043', ownClient: false });
  });
});

test('l5/config.json que declara OUTRO cliente não sequestra a release', () => {
  withVm((root, writeConfig) => {
    writeConfig(['config.json'], '102043');
    // o l5 do 102047 aponta 102043 como client (config copiado) — não vale como "sou eu"
    writeConfig(['mls-102047', 'l5', 'config.json'], '102043');
    assert.deepEqual(clientIdForRelease(root, '102047'), { clientId: '102043', ownClient: false });
  });
});

function gitRepo(dir, args) {
  return spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
}

test('restoreWorktree devolve l5/config.json recomposto para o HEAD (gb85)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gb85-restore-'));
  const repo = join(root, 'mls-102052');
  try {
    mkdirSync(join(repo, 'l5'), { recursive: true });
    writeFileSync(join(repo, 'l5', 'config.json'), '{"ok":1}\n');
    gitRepo(repo, ['init', '-q', '-b', 'main']);
    gitRepo(repo, ['config', 'user.email', 't@t']);
    gitRepo(repo, ['config', 'user.name', 't']);
    gitRepo(repo, ['config', 'commit.gpgsign', 'false']);
    gitRepo(repo, ['add', '-A']);
    const committed = gitRepo(repo, ['commit', '-q', '-m', 'init']);
    assert.equal(committed.status, 0, `${committed.stdout ?? ''}${committed.stderr ?? ''}`);
    writeFileSync(join(repo, 'l5', 'config.json'), '{"dirty":1}\n');
    assert.match(gitRepo(repo, ['status', '--porcelain']).stdout, /l5\/config\.json/);
    restoreWorktree(root, 'mls-102052');
    assert.equal(readFileSync(join(repo, 'l5', 'config.json'), 'utf8'), '{"ok":1}\n');
    assert.equal(gitRepo(repo, ['status', '--porcelain']).stdout.trim(), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('shouldDeferPm2Reload: CGI env defers without COLLAB_GIT_HTTP; ssh does not', () => {
  assert.equal(shouldDeferPm2Reload({ GIT_PROJECT_ROOT: '/data/mls-base', REQUEST_METHOD: 'POST' }), true);
  assert.equal(shouldDeferPm2Reload({}), false);
  assert.equal(shouldDeferPm2Reload({ COLLAB_PUSH_ACTOR_EMAIL: 'a@b' }), false);
  assert.equal(shouldDeferPm2Reload({ GIT_PROJECT_ROOT: '/data/mls-base' }), false);
  assert.equal(shouldDeferPm2Reload({ REQUEST_METHOD: 'POST' }), false);
  assert.equal(shouldDeferPm2Reload({ COLLAB_GIT_HTTP: '1' }), true);
});

test('scheduleDetachedPm2Reload dispara o mesmo script --reload-pm2 (detached) e não espera o pm2', () => {
  const root = mkdtempSync(join(tmpdir(), 'gb85-sched-'));
  try {
    writeFileSync(join(root, 'pm2.config.js'), 'module.exports = [];\n');
    const calls = [];
    const spawnFn = (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      return { unref() {}, pid: 4242 };
    };
    const planned = scheduleDetachedPm2Reload(root, { spawnFn, delaySec: 2, appName: 'app2043' });
    assert.equal(planned.pm2Config, 'pm2.config.js');
    assert.equal(planned.delaySec, 2);
    assert.equal(planned.appName, 'app2043');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].cmd, process.execPath);
    assert.equal(calls[0].opts.detached, true);
    assert.equal(calls[0].opts.stdio[0], 'ignore');
    assert.ok(calls[0].args.includes('--reload-pm2'));
    assert.ok(calls[0].args.includes('--app'));
    assert.ok(calls[0].args.includes('app2043'));
    assert.ok(calls[0].args.includes(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function worker(appName, pmId, { uptime, restart }) {
  return { name: appName, pm_id: pmId, pm2_env: { pm_uptime: uptime, restart_time: restart } };
}

test('parsePm2Jlist ignora ruído e devolve o array', () => {
  assert.deepEqual(parsePm2Jlist(''), []);
  assert.deepEqual(parsePm2Jlist('not json'), []);
  const listed = parsePm2Jlist('noise\n[{"name":"app2043","pm_id":0}]\n');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].name, 'app2043');
});

test('staleClusterWorkers: dois novos silenciam; um velho é nomeado', () => {
  const appName = 'app2043';
  const before = { 0: 1, 1: 1 };
  const fresh = [
    worker(appName, 0, { uptime: 5000, restart: 2 }),
    worker(appName, 1, { uptime: 5100, restart: 2 }),
  ];
  assert.deepEqual(staleClusterWorkers(fresh, { appName, reloadStartedAt: 1000, restartTimeBefore: before }), []);
  const mixed = [
    worker(appName, 0, { uptime: 5000, restart: 2 }),
    worker(appName, 1, { uptime: 100, restart: 1 }),
  ];
  const stale = staleClusterWorkers(mixed, { appName, reloadStartedAt: 1000, restartTimeBefore: before });
  assert.equal(stale.length, 1);
  assert.equal(stale[0].pm_id, 1);
  assert.equal(formatStaleWorkerLog(appName, 1), 'app2043 worker 1 still on the previous release');
});

test('detector: dois workers novos ⇒ silêncio; um velho ⇒ log + retry uma vez', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gb94-detect-'));
  try {
    writeFileSync(join(root, 'pm2.config.js'), 'module.exports = [];\n');
    const appName = 'app2043';
    const before = [
      worker(appName, 0, { uptime: 100, restart: 1 }),
      worker(appName, 1, { uptime: 100, restart: 1 }),
    ];
    const fresh = [
      worker(appName, 0, { uptime: 5000, restart: 2 }),
      worker(appName, 1, { uptime: 5100, restart: 2 }),
    ];
    const mixed = [
      worker(appName, 0, { uptime: 5000, restart: 2 }),
      worker(appName, 1, { uptime: 100, restart: 1 }),
    ];
    const afterRetry = [
      worker(appName, 0, { uptime: 6000, restart: 3 }),
      worker(appName, 1, { uptime: 6100, restart: 2 }),
    ];

    const silentLogs = [];
    const silentRuns = [];
    const silentLists = [before, fresh];
    let silentI = 0;
    await reloadPm2Now(root, {
      appName,
      now: () => 1000,
      write: (text) => silentLogs.push(text),
      run: async (cmd, args) => {
        silentRuns.push({ cmd, args });
        return { code: 0, out: '' };
      },
      jlistFn: async () => silentLists[Math.min(silentI++, silentLists.length - 1)],
    });
    assert.equal(silentLogs.some((line) => line.includes('still on the previous release')), false);
    assert.equal(silentRuns.filter((call) => call.args.includes('startOrReload')).length, 1);

    const staleLogs = [];
    const staleRuns = [];
    const staleLists = [before, mixed, afterRetry];
    let staleI = 0;
    await reloadPm2Now(root, {
      appName,
      now: () => 1000,
      write: (text) => staleLogs.push(text),
      run: async (cmd, args) => {
        staleRuns.push({ cmd, args });
        return { code: 0, out: '' };
      },
      jlistFn: async () => staleLists[Math.min(staleI++, staleLists.length - 1)],
    });
    assert.ok(staleLogs.some((line) => line.includes('app2043 worker 1 still on the previous release')));
    assert.ok(staleLogs.some((line) => line.includes('retry pm2 reload (uneven workers)')));
    assert.equal(staleRuns.filter((call) => call.args.includes('startOrReload')).length, 2);
    assert.equal(staleLogs.filter((line) => line.includes('still on the previous release')).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('o hook sempre passa --skip-pm2 e só recarrega depois do restoreWorktree', () => {
  const src = readFileSync(join(HERE, 'gitPostReceive.mjs'), 'utf8');
  assert.match(src, /releaseArgs\.push\('--skip-pm2'\)/);
  const restoreCall = src.indexOf('restoreWorktree(root, projectName);');
  const markerCall = src.indexOf('${formatOkMarker(projectName, ts, verdict.declWarn)}');
  const reloadCall = src.indexOf('shouldDeferPm2Reload(process.env)');
  assert.ok(restoreCall > 0 && markerCall > restoreCall, 'marker after restore');
  assert.ok(reloadCall > markerCall, 'pm2 after marker');
  assert.equal(pm2ConfigRel(tmpdir()), 'servers/pm2.config.js');
});

test('o hook compila o fecho incremental depois do gate e antes da release', () => {
  const src = readFileSync(join(HERE, 'gitPostReceive.mjs'), 'utf8');
  const gate = src.indexOf("['scripts/runtime/buildProjectsObj.mjs', '--only', id, '--force']");
  const fecho = src.indexOf('compileFecho(root, clientId)');
  const release = src.indexOf("releaseArgs = ['scripts/runtime/addNewVersion.mjs']");
  assert.ok(gate > 0 && fecho > gate, 'fecho after pushed-project --force gate');
  assert.ok(release > fecho, 'release after fecho compile');
  assert.match(src, /CBE_BUILD_OBJS: 'false'/);
});

test('fecho é lido do l5/config.json do cliente e compilado sem --force', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gb92-fecho-'));
  try {
    mkdirSync(join(root, 'mls-900001', 'l5'), { recursive: true });
    mkdirSync(join(root, 'mls-900002'), { recursive: true });
    writeFileSync(
      join(root, 'mls-900001', 'l5', 'config.json'),
      JSON.stringify({
        projects: {
          900001: { type: 'client' },
          900002: { type: 'master frontend' },
          900003: { type: 'lib' },
        },
      }),
    );
    const plan = planFechoCompile(root, '900001');
    assert.deepEqual(plan.ids, ['900001', '900002', '900003']);
    assert.deepEqual(plan.present, ['900001', '900002']);
    assert.deepEqual(plan.missing, ['900003']);
    assert.deepEqual(plan.args, ['scripts/runtime/buildProjectsObj.mjs', '--only', '900001,900002']);
    assert.equal(plan.args.includes('--force'), false);

    const calls = [];
    const notes = [];
    const run = async (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      return { code: 0, out: '[buildProjectsObj] summary: built [-] | up-to-date [900001, 900002] | failed [-]' };
    };
    const result = await compileFecho(root, '900001', { run, write: (text) => notes.push(text) });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args, plan.args);
    assert.equal(calls[0].opts.env.BUILDCI_OFFLINE, '1');
    assert.equal(calls[0].args.includes('--force'), false);
    assert.ok(notes.some((line) => line.includes(fechoMissingMessage('900003'))));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('falha de um projeto do fecho aborta nomeando-o', () => {
  const out = [
    '[buildProjectsObj] mls-900002 FAILED (previous obj stays): boom',
    '[buildProjectsObj] summary: built [900001] | up-to-date [-] | failed [900002]',
  ].join('\n');
  const result = fechoCompileVerdict(0, out);
  assert.equal(result.ok, false);
  assert.equal(result.project, 'mls-900002');
  const printed = formatErrorOutput(result.project, result.verdict);
  assert.match(printed, /##gitBackend build=error project=mls-900002##/);
});

test('projeto do fecho ausente na VM só registra, não entra no --only', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gb92-fecho-miss-'));
  try {
    mkdirSync(join(root, 'mls-900001', 'l5'), { recursive: true });
    writeFileSync(
      join(root, 'mls-900001', 'l5', 'config.json'),
      JSON.stringify({ projects: { 900001: { type: 'client' }, 900002: { type: 'lib' } } }),
    );
    const plan = planFechoCompile(root, '900001');
    assert.deepEqual(plan.missing, ['900002']);
    assert.deepEqual(plan.present, ['900001']);
    assert.equal(plan.args[2], '900001');
    const notes = [];
    const run = async () => ({ code: 0, out: '[buildProjectsObj] summary: built [-] | up-to-date [900001] | failed [-]' });
    await compileFecho(root, '900001', { run, write: (text) => notes.push(text) });
    assert.ok(notes.some((line) => line.includes(fechoMissingMessage('900002'))));
    assert.equal(fechoMissingMessage('900002'), 'gitPostReceive: mls-900002 does not exist on the VM — ignored');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseBuildObjSummary lê built / up-to-date / failed', () => {
  const parsed = parseBuildObjSummary('[buildProjectsObj] summary: built [900001] | up-to-date [900002] | failed [-]');
  assert.deepEqual(parsed, { built: ['900001'], skipped: ['900002'], failed: [] });
});

test('authorNote anota divergência entre quem empurrou e quem assinou o commit', () => {
  // Igual (inclusive caixa diferente) ⇒ nada a dizer; a nota existe para o caso raro.
  assert.equal(authorNote('w@collab.codes', 'w@collab.codes'), '');
  assert.equal(authorNote('W@Collab.Codes', 'w@collab.codes  '), '');
  // Divergente ⇒ anota, NÃO recusa: duas identidades git é o caso normal de quem trabalha em
  // máquinas diferentes, e recusar o push por isso trocaria auditoria por bloqueio (gb50, alpha).
  assert.match(authorNote('w@collab.codes', 'outro@x.com'), /identidades divergentes/u);
  assert.match(authorNote('w@collab.codes', ''), /autor do commit desconhecido/u);
  // Sem a variável do /git/ (push por ssh na lima) não há nada para comparar.
  assert.equal(authorNote('', 'qualquer@x.com'), '');
});

test('reportClientConfig avisa, grava jsonl e NÃO lança — release segue', () => {
  const root = mkdtempSync(join(tmpdir(), 'client-config-hook-'));
  try {
    mkdirSync(join(root, 'mls-102039', 'l5'), { recursive: true });
    writeFileSync(join(root, 'mls-102039', 'l5', 'config.json'), '{}\n');
    const lines = [];
    const result = reportClientConfig(root, '102039', {
      write: (text) => lines.push(text),
      now: () => '2026-09-06T00:00:00.000Z',
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((row) => row.includes('shellTemplates.spa is required')));
    const printed = lines.join('');
    assert.match(printed, /WARN \(does not block\)/);
    assert.match(printed, /##clientConfig warn n=\d+##/);
    const log = readFileSync(join(root, 'logs', 'git-push.jsonl'), 'utf8');
    const row = JSON.parse(log.trim());
    assert.equal(row.endpoint, 'clientConfig');
    assert.equal(row.ok, false);
    assert.equal(row.projectId, '102039');
    assert.ok(row.errors.includes('shellTemplates.spa is required'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hook chama reportClientConfig no build do cliente, não no skip-build', () => {
  const src = readFileSync(join(HERE, 'gitPostReceive.mjs'), 'utf8');
  const skip = src.indexOf('if (skipBuild)');
  const report = src.indexOf('reportClientConfig(root, id)');
  const compile = src.indexOf("['scripts/runtime/buildProjectsObj.mjs', '--only', id, '--force']");
  assert.ok(skip > 0 && report > skip, 'validate after skip-build return');
  assert.ok(compile > report, 'validate before compile — warning even if build is red');
  assert.match(src, /does not block/);
  assert.doesNotMatch(src, /process\.exit\([^)]*result/);
});
