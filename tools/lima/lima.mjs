#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import {
  LONG_TIMEOUT_MS,
  assertProjectId,
  beginSession,
  endSession,
  publicView,
  refuseRemoteArgv,
  resolveLocalProfile,
  statusSession,
} from './session.mjs';

const SESSION_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/u;

export function usage() {
  return [
    'usage: node tools/lima/lima.mjs <command>',
    '  begin 102047 --session <name>',
    '  status [--session <name>]',
    '  prepare 102047 --session <name> [--db migrate|reset]',
    '  end --session <name>',
    'help and status do not start prepare or a browser.',
    'prepare is parsed here and runs only in a later step.',
  ].join('\n');
}

function takeSession(argv, index) {
  const flag = argv[index];
  if (flag === '--session') return argv[index + 1] || '';
  if (flag.startsWith('--session=')) return flag.slice('--session='.length);
  return null;
}

export function parseCli(argv) {
  refuseRemoteArgv(argv);
  const args = argv.filter((arg) => arg !== '--');
  if (args.length === 0 || args.includes('--help') || args.includes('-h') || args[0] === 'help') {
    return { command: 'help' };
  }
  const command = args[0];
  if (!['begin', 'status', 'prepare', 'end'].includes(command)) {
    throw Object.assign(new Error(usage()), { code: 'usage', exitCode: 2 });
  }
  let session = '';
  let projectId = '';
  let db = 'migrate';
  const positional = [];
  for (let i = 1; i < args.length; i += 1) {
    const sessionValue = takeSession(args, i);
    if (sessionValue != null) {
      session = sessionValue;
      if (args[i] === '--session') i += 1;
      continue;
    }
    if (args[i] === '--db') {
      db = args[++i] || '';
      continue;
    }
    if (args[i].startsWith('--db=')) {
      db = args[i].slice('--db='.length);
      continue;
    }
    if (args[i].startsWith('--')) throw Object.assign(new Error(`unknown argument ${args[i]}`), { code: 'usage', exitCode: 2 });
    positional.push(args[i]);
  }
  if (command === 'begin' || command === 'prepare') {
    projectId = positional[0] || '';
    if (positional.length !== 1) throw Object.assign(new Error(usage()), { code: 'usage', exitCode: 2 });
    assertProjectId(projectId);
  } else if (positional.length !== 0) {
    throw Object.assign(new Error(usage()), { code: 'usage', exitCode: 2 });
  }
  if (command !== 'status' && !SESSION_NAME.test(session)) {
    throw Object.assign(new Error('--session is required'), { code: 'usage', exitCode: 2 });
  }
  if (session && !SESSION_NAME.test(session)) {
    throw Object.assign(new Error('--session is invalid'), { code: 'usage', exitCode: 2 });
  }
  if (command === 'prepare' && db !== 'migrate' && db !== 'reset') {
    throw Object.assign(new Error('--db must be migrate or reset'), { code: 'usage', exitCode: 2 });
  }
  return { command, session, projectId, db };
}

function printView(view) {
  process.stdout.write(`${JSON.stringify(publicView(view))}\n`);
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const parsed = parseCli(argv);
  if (parsed.command === 'help') {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const profile = resolveLocalProfile(undefined, env);
  if (parsed.command === 'prepare') {
    process.stderr.write(`prepare refused until s7\nprojectId: ${parsed.projectId}\nsession: ${parsed.session}\ndb: ${parsed.db}\n`);
    return 2;
  }
  if (parsed.command === 'begin') {
    const begun = await beginSession(profile, parsed.session, parsed.projectId);
    printView({ ...begun.view, resumed: begun.resumed });
    return 0;
  }
  if (parsed.command === 'status') {
    printView(await statusSession(profile, parsed.session || ''));
    return 0;
  }
  printView(await endSession(profile, parsed.session));
  return 0;
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(entry).href === import.meta.url;
}

if (invokedDirectly()) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    const body = error.result ? `${JSON.stringify(publicView(error.result))}\n` : '';
    process.stderr.write(`${body}${error.message}\n`);
    process.exitCode = error.exitCode || (error.code === 'busy' ? 73 : 1);
  });
}

export { LONG_TIMEOUT_MS };
