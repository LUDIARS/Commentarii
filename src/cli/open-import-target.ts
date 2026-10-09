// The bundle an import writes into: its game ID and coordinates (from the manifest) and the
// current content of every file, so that a re-import can merge instead of overwrite.

import type { Manifest } from '../domain/documents.ts';
import { ImportError } from '../import/import-error.ts';
import type { CliIo } from './cli-io.ts';

export interface ImportTarget {
  readonly gameId: string;
  readonly coordinates: Manifest['coordinates'];
  /** Bundle-relative path -> parsed JSON (schema-valid or not). */
  readonly existing: ReadonlyMap<string, unknown>;
  /** Files that exist but cannot be parsed; an import must not overwrite them blindly. */
  readonly unreadable: ReadonlySet<string>;
}

export async function openImportTarget(io: CliIo, bundleDir: string): Promise<ImportTarget> {
  const load = await io.openBundle(bundleDir);
  const manifest = load.bundle.manifest?.doc;
  if (manifest === undefined) throw new ImportError(`${bundleDir} has no valid manifest.json (run guide validate)`);
  const existing = new Map(load.files.map((file) => [file.path, file.data]));
  const unreadable = new Set(load.issues.filter((issue) => !existing.has(issue.path)).map((issue) => issue.path));
  return { gameId: manifest.game_id, coordinates: manifest.coordinates, existing, unreadable };
}
