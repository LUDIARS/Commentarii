// Runs an external narrator (e.g. a script calling an LLM) without a shell: the commentary input
// JSON goes to its stdin, its stdout is the prose. The program gets nothing else: no file path,
// no bundle, no environment beyond the caller's. A non-zero exit or a timeout is an error.

import { spawn } from 'node:child_process';

export type Narrate = (program: string, input: string) => Promise<string>;

const NARRATOR_TIMEOUT_MS = 120_000;

export const runNarratorProcess: Narrate = (program, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(program, [], { shell: false, stdio: ['pipe', 'pipe', 'pipe'], timeout: NARRATOR_TIMEOUT_MS, windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { out += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { err += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolve(out);
      else reject(new Error(`narrator ${program} failed (${signal ?? `exit ${code}`}): ${err.trim().slice(0, 300)}`));
    });
    child.stdin.end(input);
  });
