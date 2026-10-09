#!/usr/bin/env node
// `guide` entry point: wires the file system adapters into the CLI.

import { openBundleDir } from '../adapters/fs/open-bundle-dir.ts';
import { openReplayFile } from '../adapters/fs/replay-open-file.ts';
import { writeOutputFiles } from '../adapters/fs/write-output-files.ts';
import { runCli } from './run-cli.ts';

try {
  process.exitCode = await runCli(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    openBundle: openBundleDir,
    writeFiles: writeOutputFiles,
    openReplay: openReplayFile,
  });
} catch (cause) {
  process.stderr.write(`guide: ${(cause as Error).message}\n`);
  process.exitCode = 1;
}
