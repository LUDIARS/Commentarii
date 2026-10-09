// A guide import that cannot proceed because of its inputs (master data, mapping, map file,
// LLM output). The CLI prints the message instead of a stack trace and writes nothing.

export class ImportError extends Error {
  override readonly name = 'ImportError';
}
