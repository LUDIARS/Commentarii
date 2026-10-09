// The engine's only source of randomness: a seeded PRNG (mulberry32) whose whole state is one
// 32-bit integer. Same seed -> same sequence on every platform, which is what replay play
// relies on. Math.random is never used by the engine or the sim.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Current state (createRng(state) continues the sequence). */
  readonly state: number;
}

/** FNV-1a over the UTF-16 code units: maps a string seed (replay headers allow one) to 32 bits. */
function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function seedToState(seed: number | string): number {
  if (typeof seed === 'string') return hashText(seed);
  if (!Number.isFinite(seed)) throw new Error(`seed must be finite, got ${seed}`);
  return Math.trunc(seed) >>> 0;
}

export function createRng(seed: number | string): Rng {
  let state = seedToState(seed);
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get state() {
      return state;
    },
  };
}

/** Seed of an independent stream for another consumer (the sim), derived from the run seed. */
export function deriveSeed(seed: number | string, label: string): number {
  return hashText(`${seedToState(seed)}:${label}`);
}
