// @ludiars/commentarii-sdk/expression: the guide expression language. expr/1 (arithmetic) and
// expr/2 (comparison, logic, if, ID tokens, $params, context functions): tokenize, parse, point
// evaluation, interval evaluation, static check, references and its error type.

export * from './domain/expression/expression-language.ts';
export * from './domain/expression/tokenize.ts';
export * from './domain/expression/parse.ts';
export * from './domain/expression/builtins.ts';
export * from './domain/expression/evaluation-context.ts';
export * from './domain/expression/evaluate-expression.ts';
export * as intervalMath from './domain/expression/interval.ts';
export { hull, isInterval, point, truthOf, type Interval } from './domain/expression/interval.ts';
export { callIntervalBuiltin } from './domain/expression/interval-builtins.ts';
export * from './domain/expression/evaluate-interval.ts';
export * from './domain/expression/static-check.ts';
export * from './domain/expression/expression-references.ts';
export * from './domain/expression/expression-error.ts';
