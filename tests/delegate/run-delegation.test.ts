// guide run / bench / gate / replay / report signatures after the auto player moved to Ingenium
// (Ingenium R0-B): handed to `ingenium` on PATH with the arguments unchanged, or a clear exit 2.

import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseCommand } from '../../src/cli/parse-command.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import type { CliIo } from '../../src/cli/cli-io.ts';
import { isDelegatedCommand } from '../../src/delegate/delegated-command.ts';
import { findOnPath } from '../../src/delegate/find-on-path.ts';
import { runDelegation } from '../../src/delegate/run-delegation.ts';
import { quoteForCmd, spawnInherited } from '../../src/delegate/spawn-inherited.ts';
import { testImportIo } from '../support/import-io.ts';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import { openReplayFile } from '../../src/adapters/fs/replay-open-file.ts';
import { writeOutputFiles } from '../../src/adapters/fs/write-output-files.ts';
import { fsScanSource } from '../../src/audit/fs-scan-source.ts';

const MOVED = [
  ['run', '--game', 'guide/bestia', '--seed', '3'],
  ['bench', '--game', 'guide/bestia', '--runs', '2'],
  ['bench', 'compare', 'a.json', 'b.json'],
  ['bench', 'replay', '--game', 'guide/bestia', '--runs', 'replay/'],
  ['gate', 'balance', '--game', 'guide/bestia', '--base', 'a.json', '--head', 'b.json'],
  ['replay', 'play', 'run.jsonl', '--decider', 'utility-bt', '--game', 'guide/bestia'],
  ['replay', 'diff', 'a.jsonl', 'b.jsonl'],
  ['report', 'signatures', 'frames.jsonl', '--game', 'guide/bestia'],
];

function cliIo(delegation?: CliIo['delegationIo']): { io: CliIo; stderr: () => string } {
  let err = '';
  return {
    io: {
      stdout: () => {},
      stderr: (text) => void (err += text),
      openBundle: openBundleDir,
      writeFiles: writeOutputFiles,
      openReplay: openReplayFile,
      importIo: testImportIo(),
      scanSource: fsScanSource,
      ...(delegation === undefined ? {} : { delegationIo: delegation }),
    },
    stderr: () => err,
  };
}

test('the moved commands are delegated unparsed; the guide maker commands are not', () => {
  for (const argv of MOVED) {
    assert.equal(isDelegatedCommand(argv), true, argv.join(' '));
    assert.deepEqual(parseCommand(argv), { name: 'delegated', argv });
  }
  for (const argv of [['report', 'knowledge', 'guide/bestia'], ['verify', 'intent'], ['learn', 'ingest'], ['export', 'guide/bestia']]) assert.equal(isDelegatedCommand(argv), false, argv.join(' '));
});

test('without ingenium on PATH a moved command says it moved to Ingenium and exits 2', async () => {
  for (const argv of MOVED) {
    const run = cliIo({ findIngenium: () => undefined, runIngenium: async () => assert.fail('nothing to run') });
    assert.equal(await runCli(argv, run.io), 2, argv.join(' '));
    assert.match(run.stderr(), /moved to Ingenium/);
    assert.match(run.stderr(), /Ingenium に移りました/);
    assert.match(run.stderr(), new RegExp(`ingenium ${argv[0] === 'report' ? 'report signatures' : argv[0]} \\.\\.\\.`));
  }
  const unwired = cliIo();
  assert.equal(await runCli(['run', '--game', 'x'], unwired.io), 2);
});

test('with ingenium on PATH the arguments are handed over unchanged and its exit code is guide\'s', async () => {
  for (const [index, argv] of MOVED.entries()) {
    const calls: { executable: string; args: readonly string[] }[] = [];
    const run = cliIo({ findIngenium: () => '/opt/ingenium/bin/ingenium', runIngenium: async (executable, args) => (calls.push({ executable, args }), index % 3) });
    assert.equal(await runCli(argv, run.io), index % 3, argv.join(' '));
    assert.deepEqual(calls, [{ executable: '/opt/ingenium/bin/ingenium', args: argv }]);
    assert.equal(run.stderr(), '');
  }
});

test('runDelegation names the command it could not hand over', async () => {
  let err = '';
  const code = await runDelegation(['report', 'signatures', 'f.jsonl'], { stderr: (text) => void (err += text), findIngenium: () => undefined, runIngenium: async () => 0 });
  assert.equal(code, 2);
  assert.match(err, /^guide report signatures: /);
});

test('findOnPath finds a PATHEXT shim on Windows (never the bare script) and a plain file elsewhere', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cm-delegate-path-'));
  try {
    await writeFile(join(directory, 'ingenium'), '#!/bin/sh\n');
    assert.equal(findOnPath('ingenium', { PATH: directory }, 'linux'), join(directory, 'ingenium'));
    assert.equal(findOnPath('ingenium', { Path: directory, PATHEXT: '.EXE;.CMD' }, 'win32'), undefined, 'the bare script is not runnable on Windows');
    await writeFile(join(directory, 'ingenium.cmd'), '@echo off\r\n');
    assert.equal(findOnPath('ingenium', { Path: `C:\\nowhere;${directory}`, PATHEXT: '.EXE;.CMD' }, 'win32'), join(directory, 'ingenium.cmd'));
    assert.equal(findOnPath('ingenium', { PATH: '' }, 'linux'), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('quoteForCmd quotes every argument and escapes quotes and cmd metacharacters', () => {
  assert.equal(quoteForCmd('run'), '^"run^"');
  assert.equal(quoteForCmd('a b'), '^"a^ b^"');
  assert.equal(quoteForCmd('x&y|z'), '^"x^&y^|z^"');
  assert.equal(quoteForCmd('say "hi"'), '^"say^ \\^"hi\\^"^"');
  assert.equal(quoteForCmd('dir\\'), '^"dir\\\\^"');
});

test('spawnInherited runs a real ingenium shim and the arguments arrive exactly as given', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cm-delegate-spawn-'));
  try {
    const out = join(directory, 'args.json');
    const script = join(directory, 'fake-ingenium.mjs');
    await writeFile(script, `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(2)));\nprocess.exitCode = 3;\n`);
    let shim: string;
    if (process.platform === 'win32') {
      shim = join(directory, 'ingenium.cmd');
      await writeFile(shim, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`);
    } else {
      shim = join(directory, 'ingenium');
      await writeFile(shim, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
      await chmod(shim, 0o755);
    }
    const args = ['run', '--game', 'guide dir/bestia', '--record', 'out&x.jsonl', '--seed', '7'];
    assert.equal(await spawnInherited(shim, args), 3);
    assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), args);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
