// Vector helpers over observation positions ([x, y, z] in manifest units).

import type { Vector3 } from '../../replay/observation-frame.ts';

export function distance(a: Vector3, b: Vector3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Positions written into actions are rounded so recordings stay short and stable. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The point `length` away from `from` on the ground plane, in the direction away from `threat`. */
export function pointAway(from: Vector3, threat: Vector3, length: number): Vector3 {
  const dx = from[0] - threat[0];
  const dz = from[2] - threat[2];
  const norm = Math.hypot(dx, dz);
  // Standing on the threat: any direction is as good; +x keeps the result deterministic.
  const [ux, uz] = norm === 0 ? [1, 0] : [dx / norm, dz / norm];
  return [roundCoordinate(from[0] + ux * length), from[1], roundCoordinate(from[2] + uz * length)];
}
