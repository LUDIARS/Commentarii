// Runs an executable with this process's stdin / stdout / stderr (the stdio adapter protocol and
// the run report pass straight through) and resolves to its exit code (a signal counts as 1).
// No shell: a Windows .cmd / .bat shim is started through cmd.exe with each argument quoted and
// its metacharacters escaped, so arguments reach `ingenium` exactly as `guide` received them.

import { spawn } from 'node:child_process';

const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

/** One argument for cmd.exe /s /c: quoted, embedded quotes and trailing backslashes escaped, metacharacters caret-escaped. */
export function quoteForCmd(argument: string): string {
  let quoted = argument.replace(/(\\*)"/g, '$1$1\\"');
  quoted = quoted.replace(/(\\*)$/, '$1$1');
  return `"${quoted}"`.replace(CMD_META, '^$1');
}

export function spawnInherited(executable: string, args: readonly string[], platform: NodeJS.Platform = process.platform): Promise<number> {
  const viaCmd = platform === 'win32' && /\.(cmd|bat)$/i.test(executable);
  const child = viaCmd
    ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"${[executable, ...args].map(quoteForCmd).join(' ')}"`], { stdio: 'inherit', windowsVerbatimArguments: true, windowsHide: true })
    : spawn(executable, [...args], { stdio: 'inherit', shell: false, windowsHide: true });
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve(signal !== null ? 1 : (code ?? 1)));
  });
}
