import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type { GuideMap } from '../../../src/domain/documents.ts';
import { ImportError } from '../../../src/import/import-error.ts';
import { buildGuideMap } from '../../../src/import/map/build-guide-map.ts';
import type { Coordinates, NavgraphInput, ZonesInput } from '../../../src/import/map/map-request.ts';
import { parseGridCells } from '../../../src/import/map/parse-grid-cells.ts';
import type { GridMapping } from '../../../src/import/mapping.ts';
import { parseMapping } from '../../../src/import/parse-mapping.ts';
import { schemaRegistry } from '../../support/bundles.ts';
import { SAMPLE_GRID, SAMPLE_MAPPING } from '../../support/import-io.ts';

const WORLD: Coordinates = { system: 'world-xyz', unit: 'm' };
const stageId = 'stage:bestia:ring';

async function assertMapSchema(map: GuideMap): Promise<void> {
  assert.deepEqual((await schemaRegistry()).validate('map', map), []);
}

async function sampleGrid(): Promise<GridMapping> {
  const grid = parseMapping(await readFile(SAMPLE_MAPPING, 'utf8'), 'mapping.json', await schemaRegistry()).grid;
  assert.ok(grid);
  return grid;
}

test('grid: the sample ring becomes cell nodes with 4-neighbour edges and legend annotations', async () => {
  const cells = parseGridCells(await readFile(SAMPLE_GRID, 'utf8'), 'ring.grid.txt');
  const map = buildGuideMap({ kind: 'grid', stageId, sourceName: 'ring.grid.txt', coordinates: WORLD, cells, grid: await sampleGrid(), neighbors: 4 });
  await assertMapSchema(map);
  assert.deepEqual(map.size, [7, 7]);
  assert.equal(map.nodes.length, 45, '49 cells minus 4 blocked corners');
  assert.deepEqual(map.nodes[0], { id: 'node:x1-y0', cell: [1, 0], knowledge: 'shown' });
  assert.equal(map.annotations.filter((annotation) => annotation.kind === 'spawn').length, 4);
  assert.deepEqual(map.source, { kind: 'master', ref: 'ring.grid.txt' });
  assert.ok(map.edges.every((edge) => edge.cost === 1));
});

test('grid: 8 neighbours add diagonals without cutting corners; unknown cells and units fail', async () => {
  const grid: GridMapping = { legend: { '.': { walkable: true }, '#': { walkable: false } } };
  const base = { kind: 'grid' as const, stageId, sourceName: 'g.txt', coordinates: { system: 'grid' as const, unit: 'cell' }, grid };
  const open = buildGuideMap({ ...base, cells: parseGridCells('..\n..\n', 'g.txt'), neighbors: 8 });
  assert.equal(open.edges.length, 6, '4 sides + 2 diagonals');
  assert.equal(open.nodes[0]?.knowledge, 'masked', 'knowledge defaults to masked');
  await assertMapSchema(open);
  const walled = buildGuideMap({ ...base, cells: parseGridCells('.#\n#.\n', 'g.txt'), neighbors: 8 });
  assert.equal(walled.edges.length, 0, 'no diagonal through two walls');
  const json = buildGuideMap({ ...base, cells: parseGridCells('[[".", "."]]', 'g.json'), neighbors: 4 });
  assert.equal(json.edges.length, 1);
  assert.throws(() => buildGuideMap({ ...base, cells: parseGridCells('.x\n', 'g.txt'), neighbors: 4 }), /'x' is not in the grid legend/);
  assert.throws(() => buildGuideMap({ ...base, grid: { ...grid, unit: 'm' }, cells: [['.']], neighbors: 4 }), /grid unit m/);
});

test('navgraph: nodes keep positions and are normalized to map.json', async () => {
  const input: NavgraphInput = {
    coordinates: WORLD,
    nodes: [
      { id: 'entrance', pos: [0, 0, 0], knowledge: 'shown' },
      { id: 'node:aisle-3', pos: [4, 0, 2] },
    ],
    edges: [{ from: 'entrance', to: 'aisle-3', cost: 4.5, knowledge: 'shown' }],
    annotations: [{ target: 'aisle-3', kind: 'resource' }],
  };
  const map = buildGuideMap({ kind: 'navgraph', stageId, sourceName: 'nav.json', coordinates: WORLD, input });
  await assertMapSchema(map);
  assert.deepEqual(map.nodes[1], { id: 'node:aisle-3', pos: [4, 0, 2], knowledge: 'masked' });
  assert.deepEqual(map.edges[0], { from: 'node:entrance', to: 'node:aisle-3', cost: 4.5, knowledge: 'shown' });
  assert.equal(map.annotations[0]?.knowledge, 'masked');
});

test('zones: areas become nodes at their centroid and adjacency becomes edges', async () => {
  const flat: Coordinates = { system: 'world-xy', unit: 'm' };
  const input: ZonesInput = {
    zones: [
      { id: 'hall', rect: { min: [0, 0], max: [10, 4] }, knowledge: 'shown' },
      { id: 'yard', polygon: [[10, 0], [16, 0], [16, 6]], label: { ja: '中庭' } },
    ],
    adjacency: [{ from: 'hall', to: 'yard' }],
  };
  const map = buildGuideMap({ kind: 'zones', stageId, sourceName: 'zones.json', coordinates: flat, input });
  await assertMapSchema(map);
  assert.deepEqual(map.nodes[0]?.pos, [5, 2]);
  assert.deepEqual(map.nodes[1]?.pos, [14, 2]);
  assert.equal(map.edges.length, 1);
});

test('coordinates that disagree with the manifest, and dangling edges, fail', () => {
  const node = (pos: number[]) => ({ id: 'a', pos });
  const navgraph = (input: NavgraphInput) => () => buildGuideMap({ kind: 'navgraph', stageId, sourceName: 'nav.json', coordinates: WORLD, input });
  assert.throws(navgraph({ coordinates: { system: 'world-xy', unit: 'm' }, nodes: [node([0, 0, 0])], edges: [] }), /manifest says world-xyz/);
  assert.throws(navgraph({ coordinates: { system: 'world-xyz', unit: 'cm' }, nodes: [node([0, 0, 0])], edges: [] }), ImportError);
  assert.throws(navgraph({ nodes: [node([0, 0])], edges: [] }), /2 axes/);
  assert.throws(navgraph({ nodes: [node([0, 0, 0])], edges: [{ from: 'a', to: 'b' }] }), /unknown node node:b/);
  assert.throws(navgraph({ nodes: [node([0, 0, 0]), node([1, 0, 0])], edges: [] }), /defined twice/);
});
