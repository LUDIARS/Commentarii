// guide verify intent --runs ...: reads the replays, verifies, and writes the overlay side only
// (observations/divergences.json, observations/verify/*, feasibility/<stage>.json). The
// canonical bundle is never written here.

import { join } from 'node:path';
import type { CliIo } from '../../cli/cli-io.ts';
import { EXIT_OK } from '../../cli/cli-io.ts';
import { parseReplay } from '../../replay/parse-replay.ts';
import type { ReplayRun } from '../../replay/replay-record.ts';
import { DIVERGENCES_PATH } from '../intent/divergence-store.ts';
import { drawPictures } from '../report/draw-pictures.ts';
import { formatVerifyMarkdown } from '../report/format-verify-markdown.ts';
import { REPORT_JSON_PATH, REPORT_MARKDOWN_PATH, VERIFY_DIRECTORY } from '../report/verify-report.ts';
import { VerifyError } from '../verify-error.ts';
import { verifyIntent } from '../verify-intent.ts';
import { readDivergenceStore, serializeChecked } from './read-documents.ts';
import type { VerifyIntentCommand } from './verify-command.ts';
import type { VerifyIo } from './verify-io.ts';

export type VerifyCliIo = Pick<CliIo, 'stdout' | 'stderr' | 'openBundle' | 'writeFiles'>;

async function readRuns(io: VerifyIo, paths: readonly string[]): Promise<{ runs: ReplayRun[]; unreadable: string[] }> {
  const listed = await io.listFiles(paths, '.jsonl');
  if (listed.missing.length > 0) throw new VerifyError(`run path(s) not found: ${listed.missing.join(', ')}`);
  const schema = await io.replaySchema();
  const runs: ReplayRun[] = [];
  const unreadable: string[] = [];
  const seen = new Set<string>();
  for (const path of listed.files) {
    const text = await io.readText(path);
    const run = text === undefined ? undefined : parseReplay(text, schema).run;
    if (run === undefined || seen.has(run.header.run_id)) unreadable.push(path.replaceAll('\\', '/'));
    else {
      seen.add(run.header.run_id);
      runs.push(run);
    }
  }
  return { runs, unreadable };
}

export async function runVerifyIntent(command: VerifyIntentCommand, io: VerifyCliIo, verifyIo: VerifyIo): Promise<number> {
  const load = await io.openBundle(command.gameDir);
  if (load.issues.length > 0) io.stderr(`guide verify intent: ${load.issues.length} schema issue(s); invalid files are left out (run guide validate)\n`);
  const registry = await verifyIo.schemaRegistry();
  const { runs, unreadable } = await readRuns(verifyIo, command.runs);
  const store = await readDivergenceStore(verifyIo, command.gameDir, registry);
  const output = verifyIntent({ load, runs, unreadable, ...(command.persona === undefined ? {} : { persona: command.persona }), ...(store === undefined ? {} : { store }) });
  const markdown = formatVerifyMarkdown(output.report);
  const json = `${JSON.stringify(output.report, null, 2)}\n`;
  const files = new Map<string, string>([[DIVERGENCES_PATH, serializeChecked(output.store, 'divergences', registry)]]);
  for (const [path, document] of output.feasibility) files.set(path, serializeChecked(document, 'feasibility', registry));
  files.set(REPORT_JSON_PATH, json);
  files.set(REPORT_MARKDOWN_PATH, markdown);
  for (const [name, svg] of drawPictures(output.report, load.bundle)) files.set(`${VERIFY_DIRECTORY}/${name}`, svg);
  await io.writeFiles(command.gameDir, files);
  io.stdout(command.json ? json : markdown);
  const { counted, ignored_omniscient: omniscient } = output.report.runs;
  const open = output.report.stages.reduce((sum, stage) => sum + stage.divergences.length, 0);
  io.stderr(`guide verify intent: ${counted.length} run(s) verified, ${omniscient.length} omniscient ignored, ${open} divergence(s) open; wrote ${files.size} file(s) under ${join(command.gameDir)}\n`);
  return EXIT_OK;
}
