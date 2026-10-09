/** Any failure to tokenize, parse or evaluate a rule expression. */
export class ExpressionError extends Error {
  override readonly name = 'ExpressionError';
}
