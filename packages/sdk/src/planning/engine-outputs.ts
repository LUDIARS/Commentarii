// Where an engine's planning and opponent outputs live in a bundle directory (all under
// observations/, never canonical), and the one way to read and write them: schema-checked JSON,
// written as 2-space JSON with a trailing newline. A document that does not follow its schema is
// refused whole (EngineOutputError), never half-read.

import type { SchemaRegistry, SchemaViolation } from '../schema/schema-registry.ts';
import { OPPONENT_MODELS_DIR, type OpponentModel } from '../overlay/opponent-model.ts';
import type { ApprovedBudgetTable } from './approved-budget-table.ts';
import type { MethodBandit } from './method-bandit.ts';
import type { MethodReport } from './method-report.ts';
import type { PlanningProposals } from './planning-proposals.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:62d5d4fe */
import augurContract_0a1cd75d from '../contracts/read-engine-output.contract.ts'; /* augur-inject:contract-predicate:a48043c5 */

/** Bundle-relative directory of the offline method evaluation and the budget table approval. */
export const PLANNING_DIR = 'observations/planning';
export const METHOD_REPORT_PATH = `${PLANNING_DIR}/method-report.json`;
export const PLANNING_PROPOSALS_PATH = `${PLANNING_DIR}/proposals.json`;
export const APPROVED_BUDGET_TABLE_PATH = `${PLANNING_DIR}/approved-budget-table.json`;
/** The online correction's statistics. */
export const METHOD_BANDIT_PATH = 'observations/selection/method-bandit.json';

export interface EngineOutputDocuments {
  readonly 'method-report': MethodReport;
  readonly 'planning-proposals': PlanningProposals;
  readonly 'approved-budget-table': ApprovedBudgetTable;
  readonly 'opponent-model': OpponentModel;
  readonly 'method-bandit': MethodBandit;
}

export type EngineOutputSchema = keyof EngineOutputDocuments;

export const ENGINE_OUTPUT_SCHEMAS: readonly EngineOutputSchema[] = ['method-report', 'planning-proposals', 'approved-budget-table', 'opponent-model', 'method-bandit'];

const SLUG_FILE = /^observations\/opponents\/[a-z0-9][a-z0-9_-]*\.json$/;

/** The schema of an engine output at a bundle-relative path, or undefined for any other path. */
export function engineOutputSchemaOf(relativePath: string): EngineOutputSchema | undefined {
  if (relativePath === METHOD_REPORT_PATH) return 'method-report';
  if (relativePath === PLANNING_PROPOSALS_PATH) return 'planning-proposals';
  if (relativePath === APPROVED_BUDGET_TABLE_PATH) return 'approved-budget-table';
  if (relativePath === METHOD_BANDIT_PATH) return 'method-bandit';
  if (relativePath.startsWith(`${OPPONENT_MODELS_DIR}/`) && SLUG_FILE.test(relativePath)) return 'opponent-model';
  return undefined;
}

export class EngineOutputError extends Error {
  override readonly name = 'EngineOutputError';
  constructor(
    readonly schema: EngineOutputSchema,
    readonly violations: readonly SchemaViolation[],
  ) {
    super(`not a ${schema} document: ${violations.map((violation) => `${violation.pointer || '/'} ${violation.message}`).join('; ')}`);
  }
}

const BYTE_ORDER_MARK = '﻿';

/** Parses and schema-checks an engine output; throws EngineOutputError for anything else. */
export function readEngineOutput<S extends EngineOutputSchema>(schema: S, text: string, registry: SchemaRegistry): EngineOutputDocuments[S] {
  let document: unknown;
  try {
    document = JSON.parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text);
  } catch (cause) {
    throw new EngineOutputError(schema, [{ pointer: '', message: `invalid JSON: ${(cause as Error).message}` }]);
  }
  const violations = registry.validate(schema, document);
  if (violations.length > 0) throw new EngineOutputError(schema, violations);
  return document as EngineOutputDocuments[S];
}
// @ts-expect-error augur-inject
readEngineOutput = contract(readEngineOutput, { ...augurContract_0a1cd75d, contractId: 'C-105', mode: 'observe', sample: 1, where: 'packages/sdk/src/planning/engine-outputs.ts:58', rule: 'contract-wrap', id: '0a1cd75d' }); /* augur-inject:contract-wrap:0a1cd75d */

/** The text of an engine output (2-space JSON, trailing newline) after a schema check. */
export function writeEngineOutput<S extends EngineOutputSchema>(schema: S, document: EngineOutputDocuments[S], registry: SchemaRegistry): string {
  const violations = registry.validate(schema, document);
  if (violations.length > 0) throw new EngineOutputError(schema, violations);
  return `${JSON.stringify(document, null, 2)}\n`;
}
