// Composes the file system with the replay parser: replay/<run-id>.jsonl on disk -> ReplayLoad.

import { readFile } from 'node:fs/promises';
import { parseReplay, type ReplayLoad } from '../../replay/parse-replay.ts';
import { createReplaySchema, type ReplaySchema } from '../../replay/replay-schema.ts';
import { readReplaySchemaDocuments } from './replay-schema-documents.ts';

let schema: Promise<ReplaySchema> | undefined;

function replaySchema(): Promise<ReplaySchema> {
  // Compiled once per process: `replay diff` opens two files with the same schema.
  schema ??= readReplaySchemaDocuments().then(createReplaySchema);
  return schema;
}

export async function openReplayFile(path: string): Promise<ReplayLoad> {
  const text = await readFile(path, 'utf8');
  return parseReplay(text, await replaySchema());
}
