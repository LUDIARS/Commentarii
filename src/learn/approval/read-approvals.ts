// Reads <bundle-dir>/observations/approvals.json (nothing approved yet when absent) and the
// human candidates guide import plays left in observations/human/candidates.json. Both are
// schema-checked; a file of another game is an error, not an empty list.

import { join } from 'node:path';
import { CANDIDATES_PATH } from '../../import/plays/human-run-path.ts';
import type { HumanCandidates } from '../../import/plays/human-candidates.ts';
import type { DocumentSchemaName } from '../../schema/schema-names.ts';
import type { LearnIo } from '../cli/learn-io.ts';
import { LearnError } from '../learn-error.ts';
import { APPROVALS_PATH, type ApprovalsFile } from './approvals.ts';

async function readChecked<T extends { game_id: string }>(io: LearnIo, bundleDir: string, path: string, schema: DocumentSchemaName, gameId: string): Promise<T | undefined> {
  const text = await io.readText(join(bundleDir, ...path.split('/')));
  if (text === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new LearnError(`${path} is not JSON: ${(cause as Error).message}`);
  }
  const violations = (await io.schemaRegistry()).validate(schema, parsed);
  if (violations.length > 0) throw new LearnError(`${path} does not follow its schema: ${violations.map((v) => `${v.pointer} ${v.message}`).join('; ')}`);
  const document = parsed as T;
  if (document.game_id !== gameId) throw new LearnError(`${path} belongs to game ${document.game_id}, not ${gameId}`);
  return document;
}

export function readApprovals(io: LearnIo, bundleDir: string, gameId: string): Promise<ApprovalsFile | undefined> {
  return readChecked<ApprovalsFile>(io, bundleDir, APPROVALS_PATH, 'approvals', gameId);
}

export function readHumanCandidates(io: LearnIo, bundleDir: string, gameId: string): Promise<HumanCandidates | undefined> {
  return readChecked<HumanCandidates & { game_id: string }>(io, bundleDir, CANDIDATES_PATH, 'human-candidates', gameId);
}
