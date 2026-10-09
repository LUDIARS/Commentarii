// The manifest is the source of truth for coordinates (design 4.5). A map whose declared system
// or unit differs, or whose points have the wrong number of axes, is rejected.

import { ImportError } from '../import-error.ts';
import type { Coordinates } from './map-request.ts';

const AXES: Readonly<Record<Coordinates['system'], number>> = { grid: 2, 'world-xy': 2, 'world-xyz': 3 };

export function assertDeclaredCoordinates(manifest: Coordinates, declared: Coordinates | undefined, sourceName: string): void {
  if (declared === undefined) return;
  if (declared.system !== manifest.system || declared.unit !== manifest.unit) {
    throw new ImportError(
      `${sourceName} uses ${declared.system} in ${declared.unit}, the manifest says ${manifest.system} in ${manifest.unit}`,
    );
  }
}

export function assertPoint(manifest: Coordinates, point: readonly number[], where: string): void {
  const axes = AXES[manifest.system];
  if (point.length !== axes) throw new ImportError(`${where}: ${point.length} axes, the manifest system ${manifest.system} has ${axes}`);
}

export function assertGridUnit(manifest: Coordinates, unit: string | undefined, sourceName: string): void {
  if (unit !== undefined && unit !== manifest.unit) {
    throw new ImportError(`${sourceName}: grid unit ${unit} differs from the manifest unit ${manifest.unit}`);
  }
}
