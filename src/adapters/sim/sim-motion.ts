// Movement on the sim's ground plane.

import type { Point } from './sim-layout.ts';

export function gap(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** One step of at most `step` units from `from` toward `to`, stopping `keep` short of it. */
export function stepToward(from: Point, to: Point, step: number, keep = 0): Point {
  const d = gap(from, to);
  const travel = Math.min(step, Math.max(d - keep, 0));
  if (d === 0 || travel === 0) return from;
  return [from[0] + ((to[0] - from[0]) / d) * travel, from[1] + ((to[1] - from[1]) / d) * travel];
}

/** One step of `step` units directly away from `threat` (+x when standing on it). */
export function stepAway(from: Point, threat: Point, step: number): Point {
  const d = gap(from, threat);
  const [ux, uz] = d === 0 ? [1, 0] : [(from[0] - threat[0]) / d, (from[1] - threat[1]) / d];
  return [from[0] + ux * step, from[1] + uz * step];
}

/** One step of `step` units sideways (counter-clockwise) relative to the direction to `threat`. */
export function stepSideways(from: Point, threat: Point, step: number): Point {
  const d = gap(from, threat);
  const [ux, uz] = d === 0 ? [1, 0] : [(threat[0] - from[0]) / d, (threat[1] - from[1]) / d];
  return [from[0] - uz * step, from[1] + ux * step];
}
