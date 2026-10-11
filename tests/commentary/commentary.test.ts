import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import { openReplayFile } from '../../src/adapters/fs/replay-open-file.ts';
import { writeOutputFiles } from '../../src/adapters/fs/write-output-files.ts';
import { parseCommentaryCommand } from '../../src/commentary/commentary-command.ts';
import { buildCommentaryInput, HIDDEN_CANDIDATE } from '../../src/commentary/commentary-input.ts';
import { formatCommentary } from '../../src/commentary/format-commentary.ts';
import { runCommentaryCommand } from '../../src/commentary/run-commentary-command.ts';
import type { ReplayRun } from '../../src/replay/replay-record.ts';
import { loadSample, REPO_ROOT, SAMPLE_DIR } from '../support/bundles.ts';

const RUN = join(REPO_ROOT, 'tests', 'fixtures', 'replay', 'dome-arena-base.jsonl');
const KITE = 'tactic:bestia:kite-wire-spider'; // discoverable
const SIDESTEP = 'tactic:bestia:sidestep-lead-shot'; // masked

async function sampleRun(): Promise<ReplayRun> {
  const load = await openReplayFile(RUN);
  assert.ok(load.run);
  return load.run;
}

/** The fixture run with the decisions of two ticks rewritten to weigh a known and a masked tactic. */
async function runWithTactics(): Promise<ReplayRun> {
  const run = structuredClone(await sampleRun());
  const ticks = run.ticks as ReplayRun['ticks'][number][];
  ticks[1] = { ...ticks[1]!, decision: [{ candidate: SIDESTEP, utility: 0.9, chosen: true }, { candidate: KITE, utility: 0.88, chosen: false }] };
  ticks[2] = { ...ticks[2]!, decision: [{ candidate: KITE, utility: 0.8, chosen: true }, { candidate: SIDESTEP, utility: 0.4, chosen: false }] };
  return run;
}

test('only decision changes are narrated; a masked tactic is never named, a known one is', async () => {
  const input = buildCommentaryInput(await runWithTactics(), (await loadSample()).bundle);
  const text = JSON.stringify(input);
  assert.doesNotMatch(text, /sidestep/);
  assert.equal(input.moments[1]?.chosen.candidate, HIDDEN_CANDIDATE);
  assert.equal(input.moments[1]?.margin, 0.02);
  assert.equal(input.moments[2]?.chosen.candidate, KITE);
  assert.ok(input.moments[2]?.chosen.name);
  assert.equal(input.moments[2]?.alternatives[0]?.candidate, HIDDEN_CANDIDATE);
  const markdown = formatCommentary(input);
  assert.match(markdown, /判断には関与しない/);
  assert.match(markdown, /僅差で/);
  assert.doesNotMatch(markdown, /sidestep/);
});

test('an omniscient run is refused', async () => {
  const run = structuredClone(await sampleRun());
  const omniscient = { ...run, header: { ...run.header, mode: 'omniscient' as const } };
  const { bundle } = await loadSample();
  assert.throws(() => buildCommentaryInput(omniscient, bundle), /player-mode/);
});

test('guide commentary writes the commentary and its exact input under observations/commentary', async () => {
  assert.throws(() => parseCommentaryCommand([RUN]), /--game/);
  assert.equal(parseCommentaryCommand([RUN, '--game', SAMPLE_DIR]).outDir, join(SAMPLE_DIR, 'observations', 'commentary'));
  const directory = await mkdtemp(join(tmpdir(), 'cm-commentary-'));
  try {
    const io = { stderr: () => {}, openBundle: openBundleDir, openReplay: openReplayFile, writeFiles: writeOutputFiles };
    assert.equal(await runCommentaryCommand(parseCommentaryCommand([RUN, '--game', SAMPLE_DIR, '--out', directory]), io), 0);
    const files = { md: await readFile(join(directory, 'bestia-dome-base.md'), 'utf8'), input: await readFile(join(directory, 'bestia-dome-base.input.json'), 'utf8') };
    assert.match(files.md, /# 実況: run:bestia-dome-base/);
    assert.ok(JSON.parse(files.input).moments.length > 0);
    let given = '';
    const narrate = async (program: string, input: string) => {
      given = input;
      return `${program} says hello`;
    };
    assert.equal(await runCommentaryCommand(parseCommentaryCommand([RUN, '--game', SAMPLE_DIR, '--out', directory, '--narrator', 'fake-llm']), io, narrate), 0);
    assert.equal(given, files.input);
    const framed = await readFile(join(directory, 'bestia-dome-base.md'), 'utf8');
    assert.match(framed, /narrator: fake-llm/);
    assert.match(framed, /fake-llm says hello/);
    assert.match(framed, /読み取り専用/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
