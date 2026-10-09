// replay/<run-id>.jsonl text -> run, or the issues that make it unusable. Each line must pass
// the line schema; then the file must be header, ticks, footer in order with the tick
// invariants (tick-invariants.ts) holding, including the player-mode masked ban.

import type { ReplayFooter, ReplayHeader, ReplayLine, ReplayRun, ReplayTick } from './replay-record.ts';
import type { ReplaySchema } from './replay-schema.ts';
import { checkTickRecord, maskedProblems } from './tick-invariants.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:27ead5eb */
import augurContract_c6aaec7e from '../contracts/parse-replay.contract.ts'; /* augur-inject:contract-predicate:1e0cc394 */

export interface ReplayIssue {
  /** 1-based line number (0 for the file as a whole). */
  readonly line: number;
  /** JSON pointer inside that line. */
  readonly pointer: string;
  readonly message: string;
}

export interface ReplayLoad {
  readonly run?: ReplayRun;
  readonly issues: readonly ReplayIssue[];
}

function splitLines(text: string): string[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function parseLines(text: string, schema: ReplaySchema, issues: ReplayIssue[]): ReplayLine[] {
  const parsed: ReplayLine[] = [];
  splitLines(text).forEach((source, index) => {
    const line = index + 1;
    let value: unknown;
    try {
      value = JSON.parse(source) as unknown;
    } catch (cause) {
      issues.push({ line, pointer: '', message: `not JSON: ${(cause as Error).message}` });
      return;
    }
    const violations = schema.validateLine(value);
    for (const violation of violations) issues.push({ line, ...violation });
    if (violations.length === 0) parsed.push(value as ReplayLine);
  });
  return parsed;
}

function assemble(lines: readonly ReplayLine[], issues: ReplayIssue[]): ReplayRun | undefined {
  const first = lines[0];
  const last = lines.at(-1);
  if (first?.type !== 'header') issues.push({ line: 1, pointer: '/type', message: 'the first line must be the header' });
  if (lines.length < 2 || last?.type !== 'footer') issues.push({ line: lines.length, pointer: '/type', message: 'the last line must be the footer' });
  lines.slice(1, -1).forEach((line, index) => {
    if (line.type !== 'tick') issues.push({ line: index + 2, pointer: '/type', message: `${line.type} is only allowed as the ${line.type === 'header' ? 'first' : 'last'} line` });
  });
  if (issues.length > 0) return undefined;
  const header = first as ReplayHeader;
  const ticks = lines.slice(1, -1) as ReplayTick[];
  const footer = last as ReplayFooter;
  for (const problem of maskedProblems(header, header, '')) issues.push({ line: 1, pointer: problem.pointer, message: problem.message });
  ticks.forEach((tick, index) => {
    for (const problem of checkTickRecord(header, ticks[index - 1], tick)) issues.push({ line: index + 2, pointer: problem.pointer, message: problem.message });
  });
  for (const problem of maskedProblems(header, footer, '')) issues.push({ line: lines.length, pointer: problem.pointer, message: problem.message });
  return issues.length > 0 ? undefined : { header, ticks, footer };
}

export function parseReplay(text: string, schema: ReplaySchema): ReplayLoad {
  const issues: ReplayIssue[] = [];
  const lines = parseLines(text, schema, issues);
  if (issues.length > 0) return { issues };
  if (lines.length === 0) return { issues: [{ line: 0, pointer: '', message: 'empty replay file' }] };
  const run = assemble(lines, issues);
  return run === undefined ? { issues } : { run, issues };
}
// @ts-expect-error augur-inject
parseReplay = contract(parseReplay, { ...augurContract_c6aaec7e, contractId: 'C-8', mode: 'observe', sample: 1, where: 'src/replay/parse-replay.ts:66', rule: 'contract-wrap', id: 'c6aaec7e' }); /* augur-inject:contract-wrap:c6aaec7e */
