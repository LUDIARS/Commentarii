import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkTickRecord } from '@ludiars/commentarii-sdk/replay';
import type { ReplayTick } from '@ludiars/commentarii-sdk/types';
import { BASE_RUN, BRANCH_RUN, fixtureText, parseText } from './replay-fixtures.ts';

function lines(text: string): string[] {
  return text.trimEnd().split('\n');
}

function withLine(text: string, index: number, edit: (line: Record<string, unknown>) => void): string {
  const all = lines(text);
  const line = JSON.parse(all[index] ?? '{}') as Record<string, unknown>;
  edit(line);
  all[index] = JSON.stringify(line);
  return `${all.join('\n')}\n`;
}

function tickObservation(line: Record<string, unknown>): Record<string, unknown> {
  return line.observation as Record<string, unknown>;
}

test('both fixtures load as header + 10 ticks + footer', async () => {
  for (const path of [BASE_RUN, BRANCH_RUN]) {
    const loaded = await parseText(await fixtureText(path));
    assert.deepEqual(loaded.issues, [], path);
    assert.equal(loaded.run?.header.mode, 'player');
    assert.equal(loaded.run?.ticks.length, 10);
    assert.equal(loaded.run?.footer.result, 'fail');
  }
});

test('CRLF line ends and a missing final newline are accepted', async () => {
  const text = await fixtureText(BASE_RUN);
  const loaded = await parseText(text.trimEnd().replaceAll('\n', '\r\n'));
  assert.deepEqual(loaded.issues, []);
});

test('a line that is not JSON or fails the schema is an issue on that line', async () => {
  const text = await fixtureText(BASE_RUN);
  const broken = lines(text);
  broken[2] = '{not json';
  const notJson = await parseText(broken.join('\n'));
  assert.equal(notJson.run, undefined);
  assert.equal(notJson.issues[0]?.line, 3);

  const badAction = await parseText(withLine(text, 3, (line) => (line.action = { wait: 0, attack: 2 })));
  assert.equal(badAction.run, undefined);
  assert.ok(badAction.issues.every((issue) => issue.line === 4));
  assert.ok(badAction.issues.length > 0);
});

test('header first, footer last and nothing else in between', async () => {
  const text = await fixtureText(BASE_RUN);
  const all = lines(text);
  const noHeader = await parseText(all.slice(1).join('\n'));
  assert.ok(noHeader.issues.some((issue) => issue.line === 1 && /first line must be the header/.test(issue.message)));
  const noFooter = await parseText(all.slice(0, -1).join('\n'));
  assert.ok(noFooter.issues.some((issue) => /last line must be the footer/.test(issue.message)));
  const twoHeaders = await parseText([all[0], ...all].join('\n'));
  assert.ok(twoHeaders.issues.some((issue) => issue.line === 2));
  assert.deepEqual((await parseText('')).issues.map((issue) => issue.message), ['empty replay file']);
});

test('ticks must increase and match their observation frame and the run mode', async () => {
  const text = await fixtureText(BASE_RUN);
  const repeated = withLine(text, 3, (line) => {
    line.tick = 1;
    tickObservation(line).tick = 1;
  });
  assert.ok((await parseText(repeated)).issues.some((issue) => issue.line === 4 && /does not follow/.test(issue.message)));

  const frameMismatch = withLine(text, 2, (line) => (line.tick = 99));
  assert.ok((await parseText(frameMismatch)).issues.some((issue) => /equal the observation tick/.test(issue.message)));

  const omniscientFrame = withLine(text, 2, (line) => (tickObservation(line).mode = 'omniscient'));
  assert.ok((await parseText(omniscientFrame)).issues.some((issue) => /differs from run mode player/.test(issue.message)));

  const twoChosen = withLine(text, 2, (line) => {
    for (const entry of line.decision as Record<string, unknown>[]) entry.chosen = true;
  });
  assert.ok((await parseText(twoChosen)).issues.some((issue) => /more than one candidate/.test(issue.message)));
});

test('a masked value in a player run is refused; the same value in an omniscient run loads', async () => {
  const text = await fixtureText(BASE_RUN);
  const masked = withLine(text, 4, (line) => {
    (tickObservation(line).self as Record<string, unknown>).hp = { value: 0.5, knowledge: 'masked' };
  });
  const refused = await parseText(masked);
  assert.equal(refused.run, undefined);
  assert.deepEqual(
    refused.issues.map((issue) => [issue.line, issue.pointer]),
    [[5, '/observation/self/hp']],
  );

  let omniscient = withLine(masked, 0, (line) => (line.mode = 'omniscient'));
  for (let index = 1; index <= 10; index += 1) omniscient = withLine(omniscient, index, (line) => (tickObservation(line).mode = 'omniscient'));
  const loaded = await parseText(omniscient);
  assert.deepEqual(loaded.issues, []);
  assert.equal(loaded.run?.header.mode, 'omniscient');
});

test('a masked value in the footer of a player run is refused', async () => {
  const text = await fixtureText(BASE_RUN);
  const masked = withLine(text, 11, (line) => (line.summary = { drop: { value: 0.1, knowledge: 'masked' } }));
  assert.deepEqual(
    (await parseText(masked)).issues.map((issue) => [issue.line, issue.pointer]),
    [[12, '/summary/drop']],
  );
});

test('the header may name the recording engine, SDK, bundle format and hash and stance (SDK 0.2.0); a stance outside the set is an issue', async () => {
  const text = await fixtureText(BASE_RUN);
  const stamped = withLine(text, 0, (line) => {
    line.engine = { name: 'ingenium', version: '0.2.0' };
    line.sdk_version = '0.2.0';
    line.bundle_format = 1;
    line.bundle_hash = `sha256:${'0'.repeat(64)}`;
    line.stance = 'guided';
  });
  const loaded = await parseText(stamped);
  assert.deepEqual(loaded.issues, []);
  assert.deepEqual(loaded.run?.header.engine, { name: 'ingenium', version: '0.2.0' });
  assert.equal(loaded.run?.header.stance, 'guided');
  const bad = await parseText(withLine(text, 0, (line) => void (line.stance = 'scripted')));
  assert.equal(bad.run, undefined);
  assert.equal(bad.issues[0]?.line, 1);
});

test('a tick may carry the decider model summary (SDK 0.3.0); an unknown affordance class is an issue', async () => {
  const text = await fixtureText(BASE_RUN);
  const model = {
    belief: { tracked: 12, unknown: 3, intervals: { 'e:1.hp': [0, 140] } },
    affordances: { now: ['action:bestia:move'], uncertain: ['action:bestia:shoot'], reachable: [], not_found: [], impossible: ['action:bestia:return'] },
  };
  const loaded = await parseText(withLine(text, 1, (line) => void (line.model = model)));
  assert.deepEqual(loaded.issues, []);
  const tick = loaded.run?.ticks[0];
  assert.deepEqual(tick?.model, model);
  const bad = await parseText(withLine(text, 1, (line) => void (line.model = { affordances: { maybe: ['action:bestia:move'] } })));
  assert.equal(bad.run, undefined);
  assert.equal(bad.issues[0]?.line, 2);
});

test('an autonomous tick may carry the planning trace and plan candidates (SDK 0.4.0); a masked value inside it is refused', async () => {
  const text = await fixtureText(BASE_RUN);
  const planning = {
    stance: 'autonomous',
    signature: 'realtime|threat|trust-low|hostile:3',
    regime: 'threat',
    trust: 0.42,
    budget_row: 'realtime/threat/low-trust',
    replanned: true,
    trigger: 'expect-broken',
    goal: { source: 'objectives', expr: 'count(hostile) == 0', clear_guaranteed: true },
    proposers: { continuation: { plans: 1 }, reactive: { plans: 3, budget: 8, used: 3 }, goap: { plans: 1, budget: 60, used: 41, status: 'partial' } },
    plan: {
      plan_id: 'plan:goap:t744:1',
      proposer: 'goap',
      goal: 'hp(e:2) <= 0',
      steps: [
        { action: 'action:bestia:move', params: { goal: 'e:2', for: 0.5 } },
        { action: 'action:bestia:shoot', params: { target: 'e:2' }, repeat_until: '!alive(e:2)' },
      ],
      cursor: 0,
    },
    experiment: { action: 'action:bestia:shoot', info: 0.4, causes: ['power(self)'] },
    receipts: [{ command_id: 'cmd:743', status: 'completed' }],
  };
  const decision = [{ candidate: 'plan:goap:t744:1', utility: 0.61, chosen: true, proposer: 'goap', parts: { value: 0.7 }, predicted: { p_success: 0.8, progress: 0.2, time_sec: 3.1, damage: 4 } }];
  const header = { stance: 'autonomous', decider: 'autonomous', curriculum: { kind: 'fresh-player', hash: `sha256:${'a'.repeat(64)}` } };
  const loaded = await parseText(withLine(withLine(text, 0, (line) => void Object.assign(line, header)), 1, (line) => void Object.assign(line, { planning, decision })));
  assert.deepEqual(loaded.issues, []);
  assert.deepEqual(loaded.run?.ticks[0]?.planning, planning);
  assert.equal(loaded.run?.header.curriculum?.kind, 'fresh-player');
  const bad = await parseText(withLine(text, 1, (line) => void (line.planning = { ...planning, regime: 'panic' })));
  assert.equal(bad.run, undefined);
  const run = loaded.run;
  const tick = run?.ticks[0];
  assert.ok(run !== undefined && tick !== undefined);
  const leaked = { ...tick, planning: { ...planning, proposers: { goap: { plans: 1, leak: { value: 1, knowledge: 'masked' } } } } } as unknown as ReplayTick;
  assert.deepEqual(
    checkTickRecord(run.header, undefined, leaked).map((problem) => problem.pointer),
    ['/planning/proposers/goap/leak'],
  );
});
