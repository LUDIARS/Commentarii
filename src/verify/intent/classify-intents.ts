// Coverage / human stage traces x one stage intent -> a class per intended item (design 8.3):
// match, interesting divergence (candidate), undesirable divergence, impossible (route / teach
// reproduced by no run), or unverified (no run to judge on). Divergent runs with the same
// signature become one divergence; those a person already accepted (allowed_divergences) are
// set apart and not reported again. Omniscient runs never reach here (select-runs.ts).

import type { AllowedDivergence, DivergenceReason, IntendedItem, Intent } from '../../domain/documents.ts';
import type { StageTrace } from '../runs/stage-trace.ts';
import { findAllowed } from './allowed-match.ts';
import { divergenceId, KIND_OF_REASON, summaryOf, type Divergence } from './divergence.ts';
import { judgeItem } from './intent-rules.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:27f05d5a */
import augurContract_a7c754fe from '../../contracts/classify-intents.contract.ts'; /* augur-inject:contract-predicate:7de5bd54 */

export type IntentClass = 'match' | 'interesting' | 'undesirable' | 'impossible' | 'unverified';

export interface IntentVerdict {
  readonly intent: string;
  readonly kind: IntendedItem['kind'];
  readonly classification: IntentClass;
  /** Traces judged. */
  readonly runs: number;
  readonly reached: number;
  readonly reproduced: number;
  /** IDs of the not-yet-accepted divergences found against this item. */
  readonly divergences: readonly string[];
  readonly allowed: number;
}

export interface AcceptedDivergence {
  readonly divergence: Divergence;
  readonly allowed: AllowedDivergence;
}

export interface IntentVerification {
  readonly stage: string;
  readonly verdicts: readonly IntentVerdict[];
  /** Not yet accepted. */
  readonly divergences: readonly Divergence[];
  readonly accepted: readonly AcceptedDivergence[];
}

export interface ClassifyInput {
  readonly intent: Intent;
  /** Traces of the intent's stage from counted (non-omniscient) runs. */
  readonly traces: readonly StageTrace[];
  /** Run IDs left out as omniscient, for the record (and the contract). */
  readonly ignoredOmniscient: readonly string[];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function groupDivergences(stage: string, item: IntendedItem, diverged: readonly { trace: StageTrace; reason: DivergenceReason }[]): Divergence[] {
  const groups = new Map<string, { reason: DivergenceReason; tactics: readonly string[]; route: readonly string[]; traces: StageTrace[] }>();
  for (const { trace, reason } of diverged) {
    const id = divergenceId(item.id, reason, { tactics: trace.tactics, route: trace.route });
    const group = groups.get(id) ?? { reason, tactics: trace.tactics, route: trace.route, traces: [] };
    group.traces.push(trace);
    groups.set(id, group);
  }
  return [...groups]
    .map(([id, group]) => {
      const signature = { tactics: [...group.tactics], route: [...group.route] };
      return {
        id,
        stage,
        intent: item.id,
        kind: KIND_OF_REASON[group.reason],
        reason: group.reason,
        summary: summaryOf(group.reason, signature),
        runs: unique(group.traces.map((trace) => trace.run)),
        personas: unique(group.traces.map((trace) => trace.persona)),
        signature,
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function classOf(item: IntendedItem, runs: number, reproduced: number, open: readonly Divergence[]): IntentClass {
  if (runs === 0) return 'unverified';
  if ((item.kind === 'route' || item.kind === 'teach') && reproduced === 0) return 'impossible';
  if (open.some((divergence) => divergence.kind === 'undesirable')) return 'undesirable';
  if (open.some((divergence) => divergence.kind === 'interesting')) return 'interesting';
  return 'match';
}

export function classifyIntents(input: ClassifyInput): IntentVerification {
  const { intent, traces } = input;
  const own = traces.filter((trace) => trace.stage === intent.stage);
  const verdicts: IntentVerdict[] = [];
  const open: Divergence[] = [];
  const accepted: AcceptedDivergence[] = [];
  for (const item of intent.intended) {
    const judgement = judgeItem(item, own);
    const found = groupDivergences(intent.stage, item, judgement.diverged);
    const itemOpen: Divergence[] = [];
    for (const divergence of found) {
      const allowed = findAllowed(intent.allowed_divergences, divergence);
      if (allowed === undefined) itemOpen.push(divergence);
      else accepted.push({ divergence, allowed });
    }
    open.push(...itemOpen);
    verdicts.push({
      intent: item.id,
      kind: item.kind,
      classification: classOf(item, judgement.targets.length, judgement.reproduced.length, itemOpen),
      runs: judgement.targets.length,
      reached: judgement.targets.filter((trace) => trace.reached).length,
      reproduced: judgement.reproduced.length,
      divergences: itemOpen.map((divergence) => divergence.id),
      allowed: found.length - itemOpen.length,
    });
  }
  return { stage: intent.stage, verdicts, divergences: open, accepted };
}
// @ts-expect-error augur-inject
classifyIntents = contract(classifyIntents, { ...augurContract_a7c754fe, contractId: 'C-50', mode: 'observe', sample: 1, where: 'src/verify/intent/classify-intents.ts:87', rule: 'contract-wrap', id: 'a7c754fe' }); /* augur-inject:contract-wrap:a7c754fe */
