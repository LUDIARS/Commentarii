// Reads <bundle-dir>/observations/planning/proposals.json (no budget table proposal when absent):
// schema-checked through the SDK, and refused when its proposals_hash is not the hash of its
// proposal list (edited after the engine made it: nothing a person should approve).

import { join } from 'node:path';
import { EngineOutputError, PLANNING_PROPOSALS_PATH, readEngineOutput, type PlanningProposals } from '@ludiars/commentarii-sdk/types';
import { contentHash } from '../approval/proposal-hash.ts';
import type { LearnIo } from '../cli/learn-io.ts';
import { LearnError } from '../learn-error.ts';

export async function readPlanningProposals(io: LearnIo, bundleDir: string): Promise<PlanningProposals | undefined> {
  const text = await io.readText(join(bundleDir, ...PLANNING_PROPOSALS_PATH.split('/')));
  if (text === undefined) return undefined;
  let proposals: PlanningProposals;
  try {
    proposals = readEngineOutput('planning-proposals', text, await io.schemaRegistry());
  } catch (cause) {
    if (cause instanceof EngineOutputError) throw new LearnError(`${PLANNING_PROPOSALS_PATH}: ${cause.message}`);
    throw cause;
  }
  if (contentHash(proposals.proposals) !== proposals.proposals_hash) throw new LearnError(`${PLANNING_PROPOSALS_PATH}: proposals_hash is not the hash of its proposals (edited after the engine made them)`);
  return proposals;
}
