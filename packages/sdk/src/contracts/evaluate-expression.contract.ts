// C-2 evaluateExpression(source, variables): a finite number, or an ExpressionError.

export default {
  post: (result: number) => Number.isFinite(result) || 'result is not a finite number',
  postThrow: (error: unknown) => (error instanceof Error && error.name === 'ExpressionError') || 'failure is not an ExpressionError',
};
