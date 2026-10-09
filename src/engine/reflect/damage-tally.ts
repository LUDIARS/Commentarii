// value-estimate lines from damage dealt (design 5: "敵 HP (与ダメ積算)"): the adapter reports
// each hit the player lands as an event { kind: 'damage-dealt', instance, amount } (the damage
// numbers the player sees) and a defeat as { kind: 'kill', instance }. The damage added up
// until the kill estimates that entity's HP. Only instances identified when hit count (the
// estimate must name an entity), and an instance first hit outside reflect's view is skipped.

import { isJsonObject } from '../../domain/value-node.ts';
import type { ObservationFrame, ObservedEvent } from '../../replay/observation-frame.ts';
import { findInstance } from '../observation/visible-entities.ts';
import { lineOf, type OverlayLine } from './overlay-line.ts';

export const DAMAGE_EVENT = 'damage-dealt';
export const KILL_EVENT = 'kill';
/** The quantity a damage tally estimates (matched against the entity's stat whose unit is hp). */
export const HP_QUANTITY = 'hp';

interface InstanceTally {
  readonly entity: string;
  readonly amount: number;
  readonly hits: number;
}

export type DamageTally = ReadonlyMap<number, InstanceTally>;

export const EMPTY_DAMAGE_TALLY: DamageTally = new Map();

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function instanceOf(event: ObservedEvent): number | undefined {
  const instance = event.instance;
  return typeof instance === 'number' && Number.isInteger(instance) ? instance : undefined;
}

function amountOf(event: ObservedEvent): number | undefined {
  const amount = event.amount;
  return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function estimateLine(frame: ObservationFrame, instance: number, tally: InstanceTally): OverlayLine {
  return {
    ...lineOf(frame, 'value-estimate'),
    entity: tally.entity,
    observed: { quantity: HP_QUANTITY, value: round3(tally.amount), basis: DAMAGE_EVENT, hits: tally.hits, instance },
  };
}

function addHit(tally: Map<number, InstanceTally>, frame: ObservationFrame, instance: number, amount: number): void {
  const current = tally.get(instance);
  if (current !== undefined) {
    tally.set(instance, { ...current, amount: current.amount + amount, hits: current.hits + 1 });
    return;
  }
  const entity = findInstance(frame, instance)?.entity;
  if (entity !== undefined) tally.set(instance, { entity, amount, hits: 1 });
}

/** The tally after this frame's events, and an estimate for every tallied instance killed. */
export function tallyDamage(tally: DamageTally, frame: ObservationFrame): { readonly tally: DamageTally; readonly lines: OverlayLine[] } {
  if (frame.events.length === 0) return { tally, lines: [] };
  const next = new Map(tally);
  const lines: OverlayLine[] = [];
  for (const event of frame.events) {
    if (!isJsonObject(event)) continue;
    const instance = instanceOf(event);
    if (instance === undefined) continue;
    const amount = amountOf(event);
    if (event.kind === DAMAGE_EVENT && amount !== undefined) addHit(next, frame, instance, amount);
    if (event.kind !== KILL_EVENT) continue;
    const done = next.get(instance);
    if (done !== undefined && done.hits > 0) lines.push(estimateLine(frame, instance, done));
    next.delete(instance);
  }
  return { tally: next, lines };
}
