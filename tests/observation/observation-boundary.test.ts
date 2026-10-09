import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameAdapter, Observed } from '../../src/adapter/game-adapter.ts';
import { runDriver } from '../../src/engine/driver.ts';
import { humanRunDeclarations } from '../../src/import/plays/observation-declarations.ts';
import type { PlaysMapping } from '../../src/import/plays/plays-mapping.ts';
import { observationBoundaryProblems } from '../../src/observation/check-observation-boundary.ts';
import { isDeclarablePath, type ObservationFieldDeclaration } from '../../src/observation/observation-fields.ts';
import type { ObservationFrame } from '../../src/replay/observation-frame.ts';
import { RecordingError } from '../../src/replay/recording-error.ts';
import { openRecording } from '../../src/replay/recording-sink.ts';
import { createWaitDecider } from '../../src/replay/wait-decider.ts';
import { frame } from '../support/personas.ts';
import { headerFields, memoryWriter, observation, parseText } from '../replay/replay-fixtures.ts';

const SECRET: ObservationFieldDeclaration = { path: 'extra.secret_hp', knowledge: 'masked', origin: 'internal enemy HP (never on screen)' };
const AMMO: ObservationFieldDeclaration = { path: 'extra.ammo', knowledge: 'shown', origin: 'ammo counter on the HUD' };
const STUN: ObservationFieldDeclaration = { path: 'events.stunned.instance', knowledge: 'discoverable', origin: 'stun stars over the instance' };

function codes(target: ObservationFrame, declarations: readonly ObservationFieldDeclaration[] = []): string[] {
  return observationBoundaryProblems(target, declarations).map((problem) => `${problem.code} ${problem.pointer}`);
}

test('a frame made of base fields only has no boundary problem', () => {
  const clean = frame({ tick: 3, extra: { ready_skills: ['skill:bestia:stun'], items: { 'item:bestia:potion': 1 } }, events: [{ kind: 'damage-dealt', instance: 2, amount: 30 }, { kind: 'kill', instance: 2 }] });
  assert.deepEqual(codes(clean), []);
});

test('an unlabelled extra.secret_hp is unregistered and refused (an undeclared value is masked)', () => {
  assert.deepEqual(codes(frame({ tick: 0, extra: { secret_hp: 87 } })), ['unregistered /extra/secret_hp']);
});

test('a self-labelled shown value in an undeclared place is still refused', () => {
  assert.deepEqual(codes(frame({ tick: 0, extra: { secret_hp: { value: 87, knowledge: 'shown' } } })), ['unregistered /extra/secret_hp']);
});

test('undeclared resources and event fields are refused; declared ones pass bare or labelled', () => {
  const base = frame({ tick: 0, events: [{ kind: 'stunned', instance: 4 }], extra: { ammo: 12 } });
  const withResource: ObservationFrame = { ...base, self: { ...base.self, resources: { stamina: 40 } } };
  assert.deepEqual(codes(withResource), ['unregistered /self/resources/stamina', 'unregistered /events/0/instance', 'unregistered /extra/ammo']);
  const declarations = [AMMO, STUN, { path: 'self.resources.stamina', knowledge: 'shown' as const, origin: 'stamina gauge' }];
  assert.deepEqual(codes(withResource, declarations), []);
  const labelled: ObservationFrame = { ...withResource, extra: { reach: 20, ammo: { value: 12, knowledge: 'shown' } } };
  assert.deepEqual(codes(labelled, declarations), []);
});

test('a field declared masked never passes, and a label looser than its declaration contradicts it', () => {
  assert.deepEqual(codes(frame({ tick: 0, extra: { secret_hp: 87 } }), [SECRET]), ['declared-masked /extra/secret_hp']);
  const loose = frame({ tick: 0, events: [{ kind: 'stunned', instance: { value: 4, knowledge: 'shown' } }] });
  assert.deepEqual(codes(loose, [STUN]), ['label-contradicts /events/0/instance']);
});

test('an unknown top-level place is refused and omniscient frames are never checked', () => {
  const odd = { ...frame({ tick: 0 }), debug: { seed: 1 } } as unknown as ObservationFrame;
  assert.deepEqual(codes(odd), ['unregistered /debug']);
  const omniscient: ObservationFrame = { ...frame({ tick: 0, extra: { secret_hp: 87 } }), mode: 'omniscient' };
  assert.deepEqual(codes(omniscient), []);
});

test('only resources, extra keys and event fields are declarable, never base fields', () => {
  assert.equal(isDeclarablePath('self.resources.stamina'), true);
  assert.equal(isDeclarablePath('extra.ammo'), true);
  assert.equal(isDeclarablePath('events.stunned.instance'), true);
  assert.equal(isDeclarablePath('extra.reach'), false);
  assert.equal(isDeclarablePath('self.pos'), false);
  assert.equal(isDeclarablePath('entities[].pos'), false);
});

test('the recorder refuses an undeclared player observation before the decider and writes no tick', async () => {
  const writer = memoryWriter();
  let decided = 0;
  const decider = { id: 'spy', decide: () => (decided++, { decision: [], action: { wait: 0 } }) };
  const sink = await openRecording({ header: headerFields(), decider, writer });
  const leaky: ObservationFrame = { ...observation(0), extra: { secret_hp: 87 } };
  await assert.rejects(sink.step(leaky), (error: unknown) => error instanceof RecordingError && error.isUnregisteredInPlayer && !error.isMaskedInPlayer);
  assert.equal(decided, 0);
  assert.equal(writer.lines.length, 1);
});

test('the loader applies the same rule: undeclared player places fail, header declarations and omniscient runs load', async () => {
  const header = { type: 'header', ...headerFields() };
  const tick = (extra: Record<string, unknown>, mode: 'player' | 'omniscient' = 'player') => ({ type: 'tick', tick: 0, t: 0, observation: { ...observation(0, mode), extra }, decision: [], action: { wait: 0 } });
  const footer = { type: 'footer', ended_at: '2026-10-09T00:00:01.000Z', result: 'success', summary: {} };
  const text = (lines: unknown[]) => lines.map((line) => `${JSON.stringify(line)}\n`).join('');

  const refused = await parseText(text([header, tick({ secret_hp: 87 }), footer]));
  assert.deepEqual(refused.issues.map((issue) => [issue.line, issue.pointer]), [[2, '/observation/extra/secret_hp']]);

  const declared = { ...header, observation_fields: [...(header.observation_fields ?? []), AMMO] };
  assert.deepEqual((await parseText(text([declared, tick({ ammo: 12 }), footer]))).issues, []);

  const omniscient = { ...header, mode: 'omniscient' };
  assert.deepEqual((await parseText(text([omniscient, tick({ secret_hp: 87 }, 'omniscient'), footer]))).issues, []);
});

test('legacy recordings without observation_fields are checked against the base registry (migration = declare in the header)', async () => {
  const { observation_fields: _dropped, ...legacy } = headerFields();
  const lines = [{ type: 'header', ...legacy }, { type: 'tick', tick: 0, t: 0, observation: observation(0), decision: [], action: { wait: 0 } }, { type: 'footer', ended_at: '2026-10-09T00:00:01.000Z', result: 'success', summary: {} }];
  const loaded = await parseText(lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
  assert.deepEqual(loaded.issues.map((issue) => issue.pointer), ['/observation/self/resources/boost']);
});

function scripted(frames: readonly ObservationFrame[]): GameAdapter {
  let next = 0;
  return {
    hello: async () => ({ game_id: 'bestia', adapter_id: 'scripted', mode: 'player' }),
    async observe(): Promise<Observed> {
      const current = frames[next++];
      return current === undefined ? { type: 'end', end: { result: 'success', summary: {} } } : { type: 'observation', frame: current };
    },
    act: async () => {},
    identify: () => undefined,
    close: async () => {},
  };
}

test('the driver stops a player run on an undeclared place before the decider, and runs on with the declaration', async () => {
  const seen: number[] = [];
  const decider = { id: 'spy', decide: (target: ObservationFrame) => (seen.push(target.tick), { decision: [], action: { wait: 0 } }) };
  const frames = [frame({ tick: 0 }), frame({ tick: 1, extra: { secret_hp: 87 } })];
  const stopped = await runDriver({ adapter: scripted(frames), decider, mode: 'player', maxTicks: 10 });
  assert.equal(stopped.stop.reason, 'masked-in-player');
  assert.deepEqual(stopped.stop.reason === 'masked-in-player' ? stopped.stop.pointers : [], ['/extra/secret_hp']);
  assert.deepEqual(seen, [0]);

  const declared = await runDriver({ adapter: scripted(frames), decider: createWaitDecider(), mode: 'player', observationFields: [{ ...SECRET, knowledge: 'discoverable' }], maxTicks: 10 });
  assert.equal(declared.stop.reason, 'game-ended');
});

test('human runs declare mapped resources with their stated knowledge; unstated ones are masked; the manifest wins', () => {
  const mapping = { self: { resources: { boost: { column: 'boost', knowledge: 'shown' }, rage: { column: 'rage' } } } } as unknown as PlaysMapping;
  const manifest: ObservationFieldDeclaration[] = [{ path: 'self.resources.boost', knowledge: 'discoverable', origin: 'manifest' }];
  assert.deepEqual(
    humanRunDeclarations(manifest, mapping).map((field) => [field.path, field.knowledge]),
    [['self.resources.boost', 'discoverable'], ['self.resources.rage', 'masked']],
  );
});
