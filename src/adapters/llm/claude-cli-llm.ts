// DraftLlm over the Claude Code CLI in print mode (`claude -p`). Commentarii holds no API key:
// LLM calls go through the locally signed-in CLI. The prompt goes in on stdin (never as an
// argument, so no shell quoting is involved) and the reply is read from stdout as UTF-8.
// It runs in the OS temp directory so that no project instructions of the caller's checkout
// leak into the draft. A missing executable fails loudly; there is no offline fallback.

import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { DraftLlm } from '../../import/spec/draft-llm.ts';

export interface ClaudeCliOptions {
  /** Executable to run. Default: COMMENTARII_CLAUDE_BIN, else `claude` on PATH. */
  readonly command?: string;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const STDERR_TAIL = 2000;

export function createClaudeCliLlm(options: ClaudeCliOptions = {}): DraftLlm {
  const command = options.command ?? process.env.COMMENTARII_CLAUDE_BIN ?? 'claude';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    complete: (prompt) =>
      new Promise<string>((resolve, reject) => {
        const child = spawn(command, ['-p', '--output-format', 'text'], {
          cwd: tmpdir(),
          shell: false,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const finish = (outcome: () => void): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          outcome();
        };
        const timer = setTimeout(() => {
          child.kill();
          finish(() => reject(new Error(`${command} -p did not answer within ${timeoutMs} ms`)));
        }, timeoutMs);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => (stdout += chunk));
        child.stderr.on('data', (chunk: string) => (stderr += chunk));
        child.once('error', (cause) =>
          finish(() => reject(new Error(`cannot run ${command} (set COMMENTARII_CLAUDE_BIN to the claude executable): ${cause.message}`))),
        );
        child.once('close', (code) =>
          finish(() => {
            if (code === 0) resolve(stdout);
            else reject(new Error(`${command} -p exited with ${String(code)}: ${stderr.slice(-STDERR_TAIL)}`));
          }),
        );
        // The child may exit before reading stdin; its exit is reported through 'close'.
        child.stdin.on('error', () => undefined);
        child.stdin.end(prompt, 'utf8');
      }),
  };
}
