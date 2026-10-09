// Test helpers for the engine: the shipped personas, a persona built from overrides, and an
// observation frame of the sample's dome arena.

import { loadPersona } from '../../src/adapters/fs/load-persona.ts';
import type { Persona } from '../../src/engine/persona/persona.ts';
import type { ObservationFrame, ObservedEntity } from '../../src/replay/observation-frame.ts';
import { SAMPLE_DIR } from './bundles.ts';

export async function shippedPersona(slug: string): Promise<Persona> {
  return loadPersona(SAMPLE_DIR, slug);
}

/** A persona with no habits (no delay, no misplay, no exploration) unless overridden. */
export function testPersona(overrides: Partial<Persona> = {}): Persona {
  return {
    slug: 'test',
    name: { en: 'Test' },
    weights: { distance: 1, hp: 1, time: 1, resource: 1, confidence: 1, metrics: 1, intent: 1, exploration: 1 },
    exploration_rate: 0,
    reaction_delay_ticks: 0,
    misplay_rate: 0,
    min_confidence: 'learned',
    hysteresis: 0.1,
    ...overrides,
  };
}

export const SPIDER = 'enemy:bestia:wire-spider';
export const BEETLE = 'enemy:bestia:bazooka-beetle';

export function enemy(entity: string, instance: number, x: number, state?: string): ObservedEntity {
  return { entity, instance, pos: [x, 0, 0], ...(state === undefined ? {} : { state_guess: `state:bestia:battle-ai#${state}` }), confidence: 1 };
}

export interface FrameOptions {
  readonly tick?: number;
  readonly hp?: number;
  readonly x?: number;
  readonly node?: string;
  readonly entities?: readonly ObservedEntity[];
  readonly mode?: ObservationFrame['mode'];
  readonly purpose?: ObservationFrame['purpose'];
  readonly extra?: Record<string, unknown>;
  readonly events?: ObservationFrame['events'];
}

export function frame(options: FrameOptions = {}): ObservationFrame {
  const tick = options.tick ?? 0;
  return {
    tick,
    t: tick / 10,
    source: 'render-tap',
    mode: options.mode ?? 'player',
    purpose: options.purpose ?? 'efficiency',
    self: { pos: [options.x ?? 0, 0, 0], hp: { value: options.hp ?? 1, knowledge: 'shown' } },
    entities: options.entities ?? [],
    stage: { id: 'stage:bestia:dome-arena', elapsed: tick / 10, node: options.node ?? 'node:mid-ring' },
    events: options.events ?? [],
    extra: { reach: 20, ...(options.extra ?? {}) },
  };
}
