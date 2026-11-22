
import { classifyPath } from '@ludiars/commentarii-sdk/bundle';
import { isJsonObject, type Bundle, type LoadResult } from '@ludiars/commentarii-sdk/types';
import { isDeepStrictEqual } from 'node:util';
import { sealProposal } from '../learn/approval/seal-proposal.ts';
import { contentHash } from '../learn/approval/proposal-hash.ts';
import type { FilePatch, Proposal } from '../learn/consolidate/proposal.ts';
import { levelBundleHash } from './level-bundle.ts';
import { isLevelFinding, type FindingTarget } from './level-reports.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:5d01db65 */
import augurContract_4e77a65c from '../contracts/level-authoring-113.contract.ts'; /* augur-inject:contract-predicate:590f3a78 */

export interface LevelEdit {
  readonly path: string;
  readonly document: unknown;
}

export interface LevelDraft {
  readonly base: string;
  readonly finding: FindingTarget;
  readonly edits: readonly LevelEdit[];
  readonly hash: string;
}

export function parseLevelEdits(data: unknown): LevelEdit[] {
  if (!Array.isArray(data) || data.length === 0 ||
      !data.every((row: unknown) => isJsonObject(row) && typeof row.path === 'string' && isJsonObject(row.document)) ||
      new Set(data.map((entry) => entry.path)).size !== data.length) {
    throw new Error('expected a nonempty array of distinct {path, document} edits');
  }
  return data as LevelEdit[];
}

export function parseLevelDraft(data: unknown): LevelDraft {
  if (!isJsonObject(data) || typeof data.base !== 'string' || typeof data.hash !== 'string' ||
      !isJsonObject(data.finding) || typeof data.finding.stage !== 'string' ||
      (data.finding.challenge !== undefined && typeof data.finding.challenge !== 'string') ||
      (data.finding.rule !== undefined && typeof data.finding.rule !== 'string') ||
      !isLevelFinding(data.finding.finding)) throw new Error('invalid level design draft');
  parseLevelEdits(data.edits);
  return data as unknown as LevelDraft;
}

export function buildLevelProposal(bundle: Bundle, finding: FindingTarget, edits: readonly LevelEdit[], load: LoadResult): Proposal {
  const manifest = bundle.manifest?.doc;
  const move = finding.finding.move;
  if (manifest === undefined || finding.finding.severity !== 'bad' || move === undefined ||
      !bundle.stages.some(({ stage }) => stage?.doc.id === finding.stage)) {
    throw new Error('a proposal needs a stage and a bad finding with a repair move');
  }
  const current = new Map(load.files.map(({ path, data }) => [path, data]));
  const files: FilePatch[] = [];
  for (const { path, document } of edits) {
    const kind = classifyPath(path);
    if (kind.type !== 'document' || kind.kind === 'manifest' || kind.kind === 'glossary') {
      throw new Error(`unsupported level proposal path: ${path}`);
    }
    const before = current.get(path);
    if (isDeepStrictEqual(before, document)) continue;
    files.push(before === undefined
      ? { path, create: true, patch: [{ op: 'add', path: '', value: document }] }
      : { path, create: false, patch: [{ op: 'test', path: '', value: before }, { op: 'replace', path: '', value: document }] });
  }
  if (files.length === 0) throw new Error('level proposal has no effective edits');
  const identity = contentHash([finding.stage, finding.challenge, finding.rule, finding.finding.id, files]);
  return sealProposal({
    id: `level-design:${identity.slice(7, 23)}`,
    kind: 'level-design',
    status: 'pending',
    reason: move,
    files,
    evidence: [],
    condition: { finding, base: levelBundleHash(load) },
  }, { game_id: manifest.game_id, manifest_version: manifest.version, builds: [] });
}
// @ts-expect-error augur-inject
buildLevelProposal = contract(buildLevelProposal, { ...augurContract_4e77a65c, contractId: 'C-113', mode: 'observe', sample: 1, where: 'src/level/build-level-proposal.ts:41', rule: 'contract-wrap', id: '4e77a65c' }); /* augur-inject:contract-wrap:4e77a65c */

export function levelProposalPath(id: string): string {
  const match = /^level-design:([0-9a-f]{16})$/.exec(id);
  if (match === null) throw new Error('invalid level design proposal ID');
  return `observations/level-design/proposals/${match[1]}.json`;
}

export function rebuildLevelProposal(load: LoadResult, draft: LevelDraft, id: string): Proposal {
  if (draft.base !== levelBundleHash(load)) throw new Error('bundle changed since the proposal was created');
  const proposal = buildLevelProposal(load.bundle, draft.finding, draft.edits, load);
  if (proposal.id !== id || proposal.content_hash !== draft.hash) throw new Error('level design proposal content changed');
  return proposal;
}
