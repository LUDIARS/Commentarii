// npm test: compile src + tests into build-test/ with tsc, then run node --test on the result.
// VESTIGIUM_LOGS_DIR points the Augur contract runtime at <repo>/logs so contract evidence
// from the test run can be aggregated with `augur contracts report`.

import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');

function run(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, shell: false, windowsHide: true, stdio: 'inherit', env });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

try {
  await rm(join(root, 'build-test'), { recursive: true, force: true });
  const compiled = await run([tsc, '-p', 'tsconfig.json'], process.env);
  if (compiled !== 0) {
    process.exitCode = compiled;
  } else {
    const env = { ...process.env, VESTIGIUM_LOGS_DIR: process.env.VESTIGIUM_LOGS_DIR ?? join(root, 'logs') };
    process.exitCode = await run(['--test', 'build-test/tests/**/*.test.js'], env);
  }
} catch (error) {
  process.stderr.write(`test runner failed: ${error.message}\n`);
  process.exitCode = 1;
}
