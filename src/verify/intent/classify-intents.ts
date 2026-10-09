// Coverage / human stage traces x one stage intent -> a class per intended item (design 8.3):
// match, interesting divergence (candidate), undesirable divergence, impossible, not-reproduced or
// unverified (no run to judge on). A route / teach no run reproduced is impossible only with a
// proof: the route cannot be walked on the stage map, or the taught tactic is not in the guide
// (an explicit constraint). Otherwise it is not-reproduced, with the sample (runs judged and the
// 95% interval of the reproduction rate): "nobody did it" is a measurement, not a proof
// (Astra review P1-3). Divergent runs with the same
// signature become one divergence; those a person already accepted (allowed_divergences) are
// set apart and not reported again. Omniscient runs never reach here (select-runs.ts).

import type { AllowedDivergence, DivergenceReason, GuideMap, IntendedItem, Intent } from '../../domain/documents.ts';
import { unwalkableRoute } from '../feasibility/route-reachability.ts';
import { wilsonInterval } from '../feasibility/sample-evidence.ts';
import type { StageTrace } from '../runs/stage-trace.ts';
import { findAllowed } from './allowed-match.ts';
import { divergenceId, KIND_OF_REASON, summaryOf, type Divergence } from './divergence.ts';
import { judgeItem } from './intent-rules.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:27f05d5a */
import augurContract_a7c754fe from '../../contracts/classify-intents.contract.ts'; /* augur-inject:contract-predicate:7de5bd54 */

export type IntentClass = 'match' | 'interesting' | 'undesirable' | 'impossible' | 'not-reproduced' | 'unverified';

export interface IntentVerdict {
  readonly intent: string;
  readonly kind: IntendedItem['kind'];
  readonly classification: IntentClass;
  /** Traces judged. */
  readonly runs: number;
  readonly reached: number;
  readonly reproduced: number;
  /** 95% Wilson interval of reproduced / runs (null without runs). */
  readonly reproduced_interval: readonly [number, number] | null;
  /** The proof behind impossible (map or missing tactic). */
  readonly proof?: string;
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
  /** The stage's full map (route proofs). */
  readonly map?: GuideMap;
  /** Tactic IDs of the guide (a teach naming none of them cannot be reproduced). */
  readonly tactics?: ReadonlySet<string>;
  /** manifest.version: acceptances made under another version are re-evaluated. */
  readonly manifestVersion?: string;
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

/** Why the item cannot be reproduced at all, or undefined when nothing proves it. */
function proofOf(item: IntendedItem, input: ClassifyInput): string | undefined {
  if (item.kind === 'route') return unwalkableRoute(item.path, input.map);
  if (item.kind === 'teach' && input.tactics !== undefined && !input.tactics.has(item.tactic)) return `${item.tactic} is not in the guide`;
  return undefined;
}

function classOf(item: IntendedItem, runs: number, reproduced: number, open: readonly Divergence[], proof: string | undefined): IntentClass {
  if (proof !== undefined) return 'impossible';
  if (runs === 0) return 'unverified';
  if ((item.kind === 'route' || item.kind === 'teach') && reproduced === 0) return 'not-reproduced';
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
      const allowed = findAllowed(intent.allowed_divergences, divergence, input.manifestVersion);
      if (allowed.state === 'match' && allowed.allowed !== undefined) accepted.push({ divergence, allowed: allowed.allowed });
      else itemOpen.push(allowed.state === 'stale' && allowed.why !== undefined ? { ...divergence, recheck: allowed.why } : divergence);
    }
    open.push(...itemOpen);
    const proof = proofOf(item, input);
    verdicts.push({
      intent: item.id,
      kind: item.kind,
      classification: classOf(item, judgement.targets.length, judgement.reproduced.length, itemOpen, proof),
      runs: judgement.targets.length,
      reached: judgement.targets.filter((trace) => trace.reached).length,
      reproduced: judgement.reproduced.length,
      reproduced_interval: wilsonInterval(judgement.reproduced.length, judgement.targets.length),
      ...(proof === undefined ? {} : { proof }),
      divergences: itemOpen.map((divergence) => divergence.id),
      allowed: found.length - itemOpen.length,
    });
  }
  return { stage: intent.stage, verdicts, divergences: open, accepted };
}
// @ts-expect-error augur-inject
classifyIntents = contract(classifyIntents, { ...augurContract_a7c754fe, contractId: 'C-50', mode: 'observe', sample: 1, where: 'src/verify/intent/classify-intents.ts:87', rule: 'contract-wrap', id: 'a7c754fe' }); /* augur-inject:contract-wrap:a7c754fe */
