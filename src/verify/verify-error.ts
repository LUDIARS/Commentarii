// A guide verify / guide report feasibility command that cannot proceed because of its inputs
// (bundle, run files, divergence store, intent). The CLI prints the message and writes nothing.

export class VerifyError extends Error {
  override readonly name = 'VerifyError';
}
