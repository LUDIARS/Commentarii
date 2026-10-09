// ルール: expression, variable table and the check calculation with the example values.

import type { Bundle } from '../bundle/bundle.ts';
import type { Rule } from '../domain/documents.ts';
import { evaluateExpression } from '../domain/expression/evaluate-expression.ts';
import { localize } from '../domain/localize.ts';
import { codeBlock, document, table } from '../markdown/markdown.ts';

function checkCalculation(rule: Rule): string {
  const examples = Object.fromEntries(Object.entries(rule.variables).map(([name, variable]) => [name, variable.example]));
  const inputs = Object.entries(examples)
    .map(([name, value]) => `${name} = ${value}`)
    .join(', ');
  try {
    const result = evaluateExpression(rule.expression, examples);
    return `検算例: ${inputs} → **${result}${rule.result_unit ? ` ${rule.result_unit}` : ''}**`;
  } catch (cause) {
    return `検算例: ${inputs} → 評価不可 (${(cause as Error).message})`;
  }
}

function renderRule(rule: Rule): string {
  const variables = table(
    ['変数', '説明', '単位', '値域', '例', '参照'],
    Object.entries(rule.variables).map(([name, variable]) => [
      name,
      localize(variable.description) || '-',
      variable.unit ?? '-',
      `${variable.range[0]} 〜 ${variable.range[1]}`,
      variable.example,
      variable.ref ?? '-',
    ]),
  );
  const draft = rule.draft === true ? ' (draft)' : '';
  return document([
    `## ${localize(rule.name)} (${rule.id})${draft}`,
    `knowledge: ${rule.knowledge} / 出典: ${rule.source.kind} ${rule.source.ref}`,
    codeBlock('text', rule.expression),
    variables,
    checkCalculation(rule),
  ]).trimEnd();
}

export function renderRules(bundle: Bundle): string {
  return document(['# ルール', ...(bundle.rules.length === 0 ? ['ルールはありません。'] : bundle.rules.map(({ doc }) => renderRule(doc)))]);
}
