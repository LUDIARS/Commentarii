// Adds one player run's digest to the overlay: its samples (metrics recomputed), estimates,
// unknown sightings and broken expects, and the run to runs.player. Entries stay sorted by
// key so the same runs give the same overlay whatever order they were ingested in per call.

import type { Overlay, OverlayMismatch, OverlayTactic, OverlayUnknown, OverlayValue } from '../overlay/overlay.ts';
import { draftEntity } from '../overlay/draft-entity.ts';
import { tacticMetrics } from '../overlay/tactic-metrics.ts';
import type { RunDigest } from './digest-run.ts';

function byKey<T>(key: (item: T) => string): (a: T, b: T) => number {
  return (a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
}

function withRun(runs: readonly string[], run: string): string[] {
  return runs.includes(run) ? [...runs] : [...runs, run];
}

function mergeTactics(tactics: readonly OverlayTactic[], digest: RunDigest): OverlayTactic[] {
  const table = new Map(tactics.map((entry) => [entry.tactic, entry]));
  for (const { tactic, variant, sample, nodes } of digest.samples) {
    const current = table.get(tactic);
    const samples = [...(current?.samples ?? []), sample];
    const seen = [...(current?.nodes ?? [])];
    for (const node of nodes) if (!seen.includes(node)) seen.push(node);
    const kept = current?.variant ?? variant;
    table.set(tactic, { tactic, ...(kept ? { variant: kept } : {}), samples, metrics: tacticMetrics(samples), nodes: seen });
  }
  return [...table.values()].sort(byKey((entry) => entry.tactic));
}

function valueKey(entity: string, quantity: string): string {
  return `${entity}\u0000${quantity}`;
}

function mergeValues(values: readonly OverlayValue[], digest: RunDigest): OverlayValue[] {
  const table = new Map(values.map((entry) => [valueKey(entry.entity, entry.quantity), entry]));
  for (const { entity, quantity, estimate } of digest.estimates) {
    const key = valueKey(entity, quantity);
    const current = table.get(key);
    table.set(key, { entity, quantity, estimates: [...(current?.estimates ?? []), estimate] });
  }
  return [...table.values()].sort(byKey((entry) => valueKey(entry.entity, entry.quantity)));
}

function mergeUnknowns(unknowns: readonly OverlayUnknown[], digest: RunDigest, gameId: string): OverlayUnknown[] {
  const table = new Map(unknowns.map((entry) => [entry.key, entry]));
  for (const unknown of digest.unknowns) {
    const current = table.get(unknown.key);
    const runs = withRun(current?.runs ?? [], digest.run);
    const sightings = (current?.sightings ?? 0) + 1;
    const base = current ?? unknown;
    table.set(unknown.key, {
      key: unknown.key,
      ...(base.entity === undefined ? {} : { entity: base.entity }),
      ...(base.signature === undefined ? {} : { signature: base.signature }),
      runs,
      sightings,
      draft: draftEntity(gameId, base, runs, sightings),
    });
  }
  return [...table.values()].sort(byKey((entry) => entry.key));
}

function mergeMismatches(mismatches: readonly OverlayMismatch[], digest: RunDigest): OverlayMismatch[] {
  const table = new Map(mismatches.map((entry) => [entry.tactic, entry]));
  for (const [tactic, count] of digest.mismatches) {
    const current = table.get(tactic);
    table.set(tactic, { tactic, count: (current?.count ?? 0) + count, runs: withRun(current?.runs ?? [], digest.run) });
  }
  return [...table.values()].sort(byKey((entry) => entry.tactic));
}

export function mergeDigest(overlay: Overlay, digest: RunDigest): Overlay {
  return {
    ...overlay,
    runs: { ...overlay.runs, player: withRun(overlay.runs.player, digest.run) },
    tactics: mergeTactics(overlay.tactics, digest),
    values: mergeValues(overlay.values, digest),
    unknown_entities: mergeUnknowns(overlay.unknown_entities, digest, overlay.game_id),
    mismatches: mergeMismatches(overlay.mismatches, digest),
  };
}
