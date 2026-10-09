// A guide learn command that cannot proceed because of its inputs (run files, overlay,
// manifest policy). The CLI prints the message instead of a stack trace and writes nothing.

export class LearnError extends Error {
  override readonly name = 'LearnError';
}
