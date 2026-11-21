import { ExpressionError, parseExpression } from '@ludiars/commentarii-sdk/expression';

export default {
  post: (result: string | undefined, text: string) => {
    try {
      parseExpression(text);
    } catch (cause) {
      if (!(cause instanceof ExpressionError)) throw cause;
      return (typeof result === 'string' && result.length > 0) || 'missing hint syntax issue';
    }
    return result === undefined || 'valid hint predicate reported as invalid';
  },
};
