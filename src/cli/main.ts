#!/usr/bin/env node
// `guide` entry point: wires the file system, SQLite, LLM and stdio adapters into the CLI.

import { createMainIo } from './main-io.ts';
import { runCli } from './run-cli.ts';

try {
  process.exitCode = await runCli(process.argv.slice(2), createMainIo({ stdout: (text) => process.stdout.write(text), stderr: (text) => process.stderr.write(text) }));
} catch (cause) {
  process.stderr.write(`guide: ${(cause as Error).message}\n`);
  process.exitCode = 1;
}
