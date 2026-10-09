// One run's observation lines -> what learning keeps of them:
//   tactic-outcome success / failure  -> a sample of that tactic (start and unresolved carry no verdict);
//   value-estimate                    -> an estimate of (entity, quantity);
//   unknown-entity                    -> a sighting of that unknown (keyed as reflect keys it);
//   mismatch                          -> a broken expect of that tactic.

import type { OverlayLine } from '../../engine/reflect/overlay-line.ts';
import type { RenderSignature } from '../../engine/reflect/unknown-entities.ts';
import { isJsonObject } from '../../domain/value-node.ts';
import type { RunObservations } from '../observations/run-observations.ts';
import type { OverlayVariant, TacticSample, ValueEstimate } from '../overlay/overlay.ts';

export interface DigestSample {
  readonly tactic: string;
  readonly variant?: OverlayVariant;
  readonly sample: TacticSample;
  readonly nodes: readonly string[];
}

export interface DigestEstimate {
  readonly entity: string;
  readonly quantity: string;
  readonly estimate: ValueEstimate;
}

export interface DigestUnknown {
  readonly key: string;
  readonly entity?: string;
  readonly signature?: RenderSignature;
}

export interface RunDigest {
  readonly run: string;
  readonly samples: readonly DigestSample[];
  readonly estimates: readonly DigestEstimate[];
  readonly unknowns: readonly DigestUnknown[];
  /** Tactic ID -> broken expects in this run. */
  readonly mismatches: ReadonlyMap<string, number>;
}

function numberAt(record: Readonly<Record<string, unknown>> | undefined, key: string): number {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function resourceOf(observed: Readonly<Record<string, unknown>> | undefined): Record<string, number> {
  const resource = observed?.resource;
  if (!isJsonObject(resource)) return {};
  return Object.fromEntries(Object.entries(resource).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] >= 0));
}

function nodesOf(observed: Readonly<Record<string, unknown>> | undefined): string[] {
  const nodes = observed?.nodes;
  return Array.isArray(nodes) ? nodes.filter((node): node is string => typeof node === 'string' && node.startsWith('node:')) : [];
}

function sampleOf(run: string, line: OverlayLine): DigestSample | undefined {
  const outcome = line.observed?.outcome;
  if (line.tactic === undefined || (outcome !== 'success' && outcome !== 'failure')) return undefined;
  const sample: TacticSample = {
    run,
    outcome,
    time_sec: numberAt(line.observed, 'time_sec'),
    damage_taken: numberAt(line.observed, 'damage_taken'),
    resource: resourceOf(line.observed),
  };
  return { tactic: line.tactic, ...(line.variant ? { variant: line.variant } : {}), sample, nodes: nodesOf(line.observed) };
}

function estimateOf(run: string, line: OverlayLine): DigestEstimate | undefined {
  const quantity = line.observed?.quantity;
  const value = line.observed?.value;
  const hits = line.observed?.hits;
  if (line.entity === undefined || typeof quantity !== 'string' || !/^[a-z][a-z0-9_]*$/.test(quantity)) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const counted = typeof hits === 'number' && Number.isInteger(hits) && hits >= 0 ? { hits } : {};
  return { entity: line.entity, quantity, estimate: { run, value, ...counted } };
}

function unknownOf(line: OverlayLine): DigestUnknown {
  const signature = line.observed?.signature;
  const known = isJsonObject(signature) ? (signature as RenderSignature) : undefined;
  if (line.entity !== undefined) return { key: line.entity, entity: line.entity };
  return known === undefined ? { key: 'unidentified' } : { key: `signature:${JSON.stringify(known)}`, signature: known };
}

export function digestRun(observations: RunObservations): RunDigest {
  const { run } = observations;
  const samples: DigestSample[] = [];
  const estimates: DigestEstimate[] = [];
  const unknowns = new Map<string, DigestUnknown>();
  const mismatches = new Map<string, number>();
  for (const line of observations.lines) {
    if (line.kind === 'tactic-outcome') {
      const sample = sampleOf(run, line);
      if (sample !== undefined) samples.push(sample);
    } else if (line.kind === 'value-estimate') {
      const estimate = estimateOf(run, line);
      if (estimate !== undefined) estimates.push(estimate);
    } else if (line.kind === 'unknown-entity') {
      const unknown = unknownOf(line);
      if (!unknowns.has(unknown.key)) unknowns.set(unknown.key, unknown);
    } else if (line.kind === 'mismatch' && line.tactic !== undefined) {
      mismatches.set(line.tactic, (mismatches.get(line.tactic) ?? 0) + 1);
    }
  }
  return { run, samples, estimates, unknowns: [...unknowns.values()], mismatches };
}
