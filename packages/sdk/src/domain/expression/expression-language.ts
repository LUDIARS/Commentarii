// Versions of the expression language. expr/1 is arithmetic + min max floor ceil abs clamp
// (rule documents); expr/2 adds comparison, logic, if, ID tokens, $parameters and context
// functions (rulebook documents). Every expr/1 text means the same under expr/2.

export const EXPRESSION_LANGUAGES = ['expr/1', 'expr/2'] as const;
export type ExpressionLanguage = (typeof EXPRESSION_LANGUAGES)[number];

/** The version bundle.json format 2 records and the rulebook documents are written in. */
export const CURRENT_EXPRESSION_LANGUAGE: ExpressionLanguage = 'expr/2';

export function isExpressionLanguage(value: unknown): value is ExpressionLanguage {
  return value === 'expr/1' || value === 'expr/2';
}
