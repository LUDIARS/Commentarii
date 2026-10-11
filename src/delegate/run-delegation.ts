// `guide run / bench / gate / replay / report signatures` after the auto player moved to
// Ingenium: with `ingenium` on PATH the arguments go to it unchanged and its exit code is guide's;
// without it guide says where the command went and exits 2 (a usage problem, never a silent 0).

import { EXIT_USAGE } from '../cli/cli-io.ts';
import { MOVED_MESSAGE } from './delegated-command.ts';

export interface DelegationIo {
  stderr(text: string): void;
  /** Path of the `ingenium` executable, or undefined when it is not installed. */
  findIngenium(): string | undefined;
  /** Runs it with the process's stdio and resolves to its exit code. */
  runIngenium(executable: string, args: readonly string[]): Promise<number>;
}

export async function runDelegation(argv: readonly string[], io: DelegationIo): Promise<number> {
  const command = argv[0] === 'report' ? 'report signatures' : (argv[0] ?? '');
  const executable = io.findIngenium();
  if (executable === undefined) {
    io.stderr(MOVED_MESSAGE(command));
    return EXIT_USAGE;
  }
  return io.runIngenium(executable, argv);
}
