
import { join } from 'node:path';
import { EXIT_INVALID, EXIT_OK, type CliIo } from '../cli/cli-io.ts';
import type { LearnIo } from '../learn/cli/learn-io.ts';
import { applyProposals } from '../learn/consolidate/apply-proposals.ts';
import { readDivergenceStore, serializeChecked } from '../verify/cli/read-documents.ts';
import { DIVERGENCES_PATH, mergeDivergences } from '../verify/intent/divergence-store.ts';
import { buildLevelProposal, levelProposalPath, parseLevelEdits, type LevelDraft } from './build-level-proposal.ts';
import { checkLevelSkeleton } from './check-level-skeleton.ts';
import { compareLevelIntent } from './compare-level-intent.ts';
import { levelBundleHash, requireLevelBundle, trialBundle } from './level-bundle.ts';
import type { LevelCommand } from './level-command.ts';
import { readLevelPrinciples } from './level-principles.ts';
import { approvedTrial, readLevelJson } from './level-proposal-io.ts';
import { findLevelFindings, parseLevelGate, parseLevelQuality } from './level-reports.ts';
import { reviewLevelTrial } from './review-level-trial.ts';
import { isLevelIntent } from './validate-level-intent.ts';
import { runValidation } from '../validate/run-validation.ts';

function json(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

async function run(command: LevelCommand, io: CliIo, files: LearnIo): Promise<number> {
  const load = await io.openBundle(command.game);
  requireLevelBundle(load);
  const registry = await files.schemaRegistry();
  const intents = load.bundle.intents.map(({ doc }) => doc);
  if (command.verb === 'check') {
    const issues = checkLevelSkeleton(intents.filter((intent) => isLevelIntent(intent, registry)), await readLevelPrinciples(command.principles));
    const references = runValidation(load).checks.find(({ id }) => id === 'V12')?.findings ?? [];
    io.stdout(json({ issues, references }));
    return issues.length === 0 && references.length === 0 ? EXIT_OK : EXIT_INVALID;
  }
  if (command.verb === 'prepare' || command.verb === 'review') {
    const prepared = await approvedTrial(files, command.game, load, command.proposal);
    if (command.verb === 'prepare') {
      if (io.writeNewLevelCopy === undefined) throw new Error('no level copy writer is configured');
      await io.writeNewLevelCopy(command.game, command.out, prepared.files);
      io.stdout(json({ copy: command.out, proposal: command.proposal, bundle_hash: prepared.trial.head }));
      return EXIT_OK;
    }
    const [base, head, gate] = await Promise.all([command.base, command.head, command.gate].map((path) => readLevelJson(files, path)));
    const result = reviewLevelTrial(prepared.trial, parseLevelQuality(base), parseLevelQuality(head), parseLevelGate(gate));
    const suffix = levelProposalPath(command.proposal).split('/').at(-1);
    await io.writeFiles(command.game, new Map([[ `observations/level-design/reviews/${suffix}`, json(result) ]]));
    io.stdout(json(result));
    return result.accepted ? EXIT_OK : EXIT_INVALID;
  }
  const report = parseLevelQuality(await readLevelJson(files, command.probe));
  const base = levelBundleHash(load);
  if (report.versions.bundle_hash !== base) throw new Error('probe report belongs to a different bundle revision');
  if (command.verb === 'verify') {
    if (io.verifyIo === undefined) throw new Error('no level verification I/O is configured');
    const current = await readDivergenceStore(io.verifyIo, command.game, registry);
    const gameId = load.bundle.manifest?.doc.game_id;
    if (gameId === undefined || (current !== undefined && current.game_id !== gameId)) throw new Error('divergence store belongs to another bundle');
    const divergences = compareLevelIntent(intents, report);
    const store = mergeDivergences(current, gameId, divergences);
    await io.writeFiles(command.game, new Map([[DIVERGENCES_PATH, serializeChecked(store, 'divergences', registry)]]));
    io.stdout(json({ divergences }));
    return EXIT_OK;
  }
  const finding = findLevelFindings(report).find((entry) => entry.stage === command.stage &&
    entry.challenge === command.challenge && entry.rule === command.rule && entry.finding.id === command.finding);
  const principles = await readLevelPrinciples();
  if (finding === undefined || finding.finding.move !== principles.moves[command.finding]) {
    throw new Error('no matching finding with a recognized repair move');
  }
  const edits = parseLevelEdits(await readLevelJson(files, command.edit));
  const proposal = buildLevelProposal(load.bundle, finding, edits, load);
  trialBundle(load, applyProposals(load.bundle, [proposal], registry), registry);
  const draft: LevelDraft = { base, finding, edits, hash: proposal.content_hash };
  const path = levelProposalPath(proposal.id);
  await io.writeFiles(command.game, new Map([[path, json(draft)]]));
  io.stdout(json({ ...proposal, draft: join(command.game, path) }));
  return EXIT_OK;
}

export async function runLevelCommand(command: LevelCommand, io: CliIo): Promise<number> {
  try {
    if (io.learnIo === undefined) throw new Error('no level file reader is configured');
    return await run(command, io, io.learnIo);
  } catch (cause) {
    io.stderr(`guide level ${command.verb}: ${(cause as Error).message}\n`);
    return EXIT_INVALID;
  }
}
