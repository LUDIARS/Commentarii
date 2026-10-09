// guide import spec / guide intent import: specification Markdown -> LLM drafts of rules,
// state machines or the stage intent. Drafts are draft: true and masked; until a human sets
// the boundary, guide validate reports them (V03), which is the intended review gate.

import { basename } from 'node:path';
import { draftFromDocument } from '../import/spec/draft-from-document.ts';
import type { DraftRequest } from '../import/spec/draft-request.ts';
import { planDraftWrites } from '../import/spec/plan-draft-writes.ts';
import { applyFileChanges } from './apply-file-changes.ts';
import { EXIT_OK, type CliIo } from './cli-io.ts';
import { openImportTarget, type ImportTarget } from './open-import-target.ts';
import type { ImportCommand } from './parse-import-command.ts';

type DraftCommand = Extract<ImportCommand, { name: 'import-spec' | 'intent-import' }>;

function draftRequest(command: DraftCommand, target: ImportTarget, document: string): DraftRequest {
  const base = { document, sourceName: basename(command.from), gameId: target.gameId };
  return command.name === 'intent-import' ? { ...base, kind: 'intent', stageSlug: command.stage } : { ...base, kind: command.kind };
}

export async function runImportDrafts(command: DraftCommand, io: CliIo): Promise<number> {
  const label = command.name === 'intent-import' ? 'intent import' : 'import spec';
  const registry = await io.importIo.schemaRegistry();
  const target = await openImportTarget(io, command.bundleDir);
  const request = draftRequest(command, target, await io.importIo.readText(command.from));
  const result = await draftFromDocument(request, { llm: io.importIo.llm, readPrompt: (name) => io.importIo.readPrompt(name), registry });
  for (const { id, reason } of result.skipped) io.stderr(`guide ${label}: left out ${id} (${reason})\n`);
  const writes = planDraftWrites(result.documents, target.existing);
  for (const path of writes.protectedPaths) io.stderr(`guide ${label}: kept ${path} (not a draft; a human owns it)\n`);
  const operations = await applyFileChanges(io, command.bundleDir, target, writes.changes, registry);
  io.stderr(`guide ${label}: wrote ${operations.writes.size} draft file(s) (draft: true, knowledge: masked; review before use)\n`);
  return EXIT_OK;
}
