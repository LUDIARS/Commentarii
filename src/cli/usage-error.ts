// A command line the CLI cannot run (exit code 2 with the usage text).

export class UsageError extends Error {
  override readonly name = 'UsageError';
}
