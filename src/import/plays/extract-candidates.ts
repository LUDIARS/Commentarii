// Alternative-solution candidates from human runs (design 8.2, 14.D): human episodes are grouped
// by stage, situation (`when`) and step sequence (`do`); a group that no guide tactic covers
// becomes a learned draft tactic. Nothing here writes the canonical bundle: adoption is stage 4
// consolidate or a human. The tactic boundary starts masked (principle 1) until a human decides.

import { createHash } from 'node:crypto';
import { parseRef } from '../../domain/id.ts';
import type { Tactic } from '../../domain/documents.ts';
import type { ReplayRun } from '../../replay/replay-record.ts';
import { coversEpisode } from './covers-episode.ts';
import type { HumanCandidate, HumanCandidates } from './human-candidates.ts';
import { segmentEpisodes, stepKey, type Episode } from './segment-episodes.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:ebe636d4 */
import augurContract_5e610e3f from '../../contracts/extract-candidates.contract.ts'; /* augur-inject:contract-predicate:38cc42f0 */

export interface CandidateExtraction {
  readonly gameId: string;
  /** Human runs (header.source human). */
  readonly runs: readonly ReplayRun[];
  /** Every tactic of the guide, whatever its boundary or state: all of them are known solutions. */
  readonly tactics: readonly Tactic[];
}

/** Shortest expect.within_sec: an episode of one tick has no measurable duration. */
const MIN_WITHIN_SEC = 0.1;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function groupKey(episode: Episode): string {
  return `${episode.situation.key}|${episode.steps.map(stepKey).join(',')}`;
}

function toCandidate(gameId: string, key: string, episodes: readonly Episode[]): HumanCandidate | undefined {
  const [first] = episodes;
  if (first === undefined) return undefined;
  const digest = createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 10);
  const stageSlug = parseRef(first.situation.stage)?.slug ?? 'stage';
  const runIds = [...new Set(episodes.map((episode) => episode.runId))].sort();
  const succeeded = new Set(episodes.filter((episode) => episode.succeeded).map((episode) => episode.runId));
  const within = Math.max(Math.round(median(episodes.map((episode) => episode.durationSec)) * 10) / 10, MIN_WITHIN_SEC);
  const tactic: Tactic = {
    id: `tactic:${gameId}:human-${digest}`,
    name: { ja: `人間の別解 ${stageSlug} ${digest}`, en: `Human alternative ${stageSlug} ${digest}` },
    when: first.situation.when,
    do: first.steps,
    expect: { within_sec: within },
    because: [first.situation.stage, ...first.situation.entities],
    knowledge: 'masked',
    confidence: 'learned',
    superseded_by: null,
    draft: true,
  };
  return {
    tactic,
    source: { kind: 'human', ref: `${runIds.join(' ')} x${episodes.length}` },
    evidence: {
      stage: first.situation.stage,
      occurrences: episodes.length,
      runs: runIds.length,
      players: new Set(episodes.map((episode) => episode.player)).size,
      run_ids: runIds,
      success_rate: Math.round((succeeded.size / runIds.length) * 1e4) / 1e4,
    },
  };
}

export function extractCandidates(input: CandidateExtraction): HumanCandidates {
  const groups = new Map<string, Episode[]>();
  for (const run of input.runs) {
    for (const episode of segmentEpisodes(run)) {
      if (input.tactics.some((tactic) => coversEpisode(tactic, episode))) continue;
      const key = groupKey(episode);
      groups.set(key, [...(groups.get(key) ?? []), episode]);
    }
  }
  const candidates = [...groups].flatMap(([key, episodes]) => {
    const candidate = toCandidate(input.gameId, key, episodes);
    return candidate === undefined ? [] : [candidate];
  });
  candidates.sort((a, b) => (a.tactic.id < b.tactic.id ? -1 : a.tactic.id > b.tactic.id ? 1 : 0));
  return { game_id: input.gameId, runs: input.runs.length, candidates };
}
// @ts-expect-error augur-inject
extractCandidates = contract(extractCandidates, { ...augurContract_5e610e3f, contractId: 'C-41', mode: 'observe', sample: 1, where: 'src/import/plays/extract-candidates.ts:69', rule: 'contract-wrap', id: '5e610e3f' }); /* augur-inject:contract-wrap:5e610e3f */
