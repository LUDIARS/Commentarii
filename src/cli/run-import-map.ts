// guide import map: grid / navgraph / zones file -> stages/<slug>/map.json. A map the bundle
// already holds from another source (human, observed) is not overwritten.

import { basename } from 'node:path';
import { isJsonObject } from '../domain/value-node.ts';
import { ImportError } from '../import/import-error.ts';
import { buildGuideMap } from '../import/map/build-guide-map.ts';
import type { MapImportRequest, NavgraphInput, ZonesInput } from '../import/map/map-request.ts';
import { parseGridCells } from '../import/map/parse-grid-cells.ts';
import { parseJsonInput } from '../import/parse-json-input.ts';
import { parseMapping } from '../import/parse-mapping.ts';
import { assertSchema } from '../import/validate-input.ts';
import type { SchemaRegistry } from '../schema/schema-registry.ts';
import { applyFileChanges } from './apply-file-changes.ts';
import { EXIT_OK, type CliIo } from './cli-io.ts';
import { openImportTarget, type ImportTarget } from './open-import-target.ts';
import type { ImportCommand } from './parse-import-command.ts';

type MapCommand = Extract<ImportCommand, { name: 'import-map' }>;

async function mapRequest(command: MapCommand, io: CliIo, target: ImportTarget, registry: SchemaRegistry): Promise<MapImportRequest> {
  const sourceName = basename(command.from);
  const text = await io.importIo.readText(command.from);
  const base = { stageId: `stage:${target.gameId}:${command.stage}`, sourceName, coordinates: target.coordinates };
  switch (command.kind) {
    case 'grid': {
      if (command.mapPath === undefined) throw new ImportError('a grid map needs --map <mapping.json> with a grid legend');
      const mappingName = basename(command.mapPath);
      const grid = parseMapping(await io.importIo.readText(command.mapPath), mappingName, registry).grid;
      if (grid === undefined) throw new ImportError(`${mappingName} has no grid legend`);
      return { ...base, kind: 'grid', cells: parseGridCells(text, sourceName), grid, neighbors: command.neighbors };
    }
    case 'navgraph': {
      const input = parseJsonInput(text, sourceName);
      assertSchema(registry, 'import-navgraph', input, sourceName);
      return { ...base, kind: 'navgraph', input: input as NavgraphInput };
    }
    case 'zones': {
      const input = parseJsonInput(text, sourceName);
      assertSchema(registry, 'import-zones', input, sourceName);
      return { ...base, kind: 'zones', input: input as ZonesInput };
    }
  }
}

function assertReplaceable(path: string, current: unknown): void {
  if (current === undefined) return;
  const kind = isJsonObject(current) && isJsonObject(current.source) ? current.source.kind : undefined;
  if (kind !== 'master') throw new ImportError(`${path} comes from ${String(kind ?? 'an unknown source')}, not master data; remove it to import a new map`);
}

export async function runImportMap(command: MapCommand, io: CliIo): Promise<number> {
  const registry = await io.importIo.schemaRegistry();
  const target = await openImportTarget(io, command.bundleDir);
  const map = buildGuideMap(await mapRequest(command, io, target, registry));
  const path = `stages/${command.stage}/map.json`;
  const current = target.existing.get(path);
  assertReplaceable(path, current);
  await applyFileChanges(io, command.bundleDir, target, [{ path, before: current, after: map }], registry);
  io.stderr(`guide import map: wrote ${path} (${map.kind}, ${map.nodes.length} node(s), ${map.edges.length} edge(s))\n`);
  return EXIT_OK;
}
