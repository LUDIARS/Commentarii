// Asks the model for a draft and accepts it only when it becomes schema-valid documents. One
// retry, with the problems of the first reply appended to the prompt; then it fails.

import { ImportError } from '../import-error.ts';
import type { DraftKindSpec } from './draft-kind.ts';
import type { DraftDeps, DraftDocument, DraftRequest } from './draft-request.ts';
import { extractJson } from './extract-json.ts';
import { fillPrompt } from './fill-prompt.ts';

export const MAX_ATTEMPTS = 2;
const RETRY_PROMPT = 'retry';

function promptValues(request: DraftRequest): Record<string, string> {
  return {
    game_id: request.gameId,
    stage_id: request.stageSlug === undefined ? '' : `stage:${request.gameId}:${request.stageSlug}`,
    source_name: request.sourceName,
    document: request.document,
  };
}

export async function requestValidDraft(spec: DraftKindSpec, request: DraftRequest, deps: DraftDeps): Promise<readonly DraftDocument[]> {
  const prompt = fillPrompt(await deps.readPrompt(spec.prompt), promptValues(request));
  let problems: readonly string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const retry = attempt === 1 ? '' : fillPrompt(await deps.readPrompt(RETRY_PROMPT), { problems: problems.map((p) => `- ${p}`).join('\n') });
    const reply = extractJson(await deps.llm.complete(`${prompt}${retry}`));
    if (!reply.ok) {
      problems = [reply.message];
      continue;
    }
    const built = spec.build(reply.data, request, deps.registry);
    if (built.problems.length === 0) return built.documents;
    problems = built.problems;
  }
  throw new ImportError(`the LLM draft is still invalid after ${MAX_ATTEMPTS} attempts:\n  ${problems.join('\n  ')}`);
}
