// Runs `guide commentary`: reads a recorded run and the guide, builds the player-filtered input,
// narrates it (built-in wording, or an external narrator given only that input), and writes the
// commentary next to the input it was made from. Nothing in the guide's canon is touched.

import { EXIT_INVALID, EXIT_OK, type CliIo } from '../cli/cli-io.ts';
import type { CommentaryCommand } from './commentary-command.ts';
import { buildCommentaryInput } from './commentary-input.ts';
import { formatCommentary, frameNarration } from './format-commentary.ts';
import { runNarratorProcess, type Narrate } from './run-narrator-process.ts';

type CommentaryIo = Pick<CliIo, 'stderr' | 'openBundle' | 'openReplay' | 'writeFiles'>;

function runSlug(runId: string): string {
  return runId.replace(/^run:/, '').replace(/[^A-Za-z0-9._-]/g, '_');
}

export async function runCommentaryCommand(command: CommentaryCommand, io: CommentaryIo, narrate: Narrate = runNarratorProcess): Promise<number> {
  const replay = await io.openReplay(command.runPath);
  if (replay.run === undefined) {
    io.stderr(`guide commentary: ${command.runPath} is not a readable run (${replay.issues.length} issue(s); see guide replay play)\n`);
    return EXIT_INVALID;
  }
  const load = await io.openBundle(command.gameDir);
  let input;
  try {
    input = buildCommentaryInput(replay.run, load.bundle);
  } catch (cause) {
    io.stderr(`guide commentary: ${(cause as Error).message}\n`);
    return EXIT_INVALID;
  }
  const inputJson = `${JSON.stringify(input, null, 2)}\n`;
  const text = command.narrator === undefined ? formatCommentary(input) : frameNarration(input, await narrate(command.narrator, inputJson), command.narrator);
  const slug = runSlug(input.run_id);
  await io.writeFiles(command.outDir, new Map([[`${slug}.md`, text], [`${slug}.input.json`, inputJson]]));
  io.stderr(`guide commentary: wrote ${slug}.md (${input.moments.length} decision change(s)) to ${command.outDir}\n`);
  return EXIT_OK;
}
