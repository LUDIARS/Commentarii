// guide import map, pure part: a parsed source map -> stages/<slug>/map.json. The three
// shapes are converted by their own module; this one dispatches and rejects a graph whose
// edges or annotations point at nodes that do not exist.

import type { GuideMap } from '../../domain/documents.ts';
import { ImportError } from '../import-error.ts';
import { gridToMap } from './grid-to-map.ts';
import type { MapImportRequest } from './map-request.ts';
import { navgraphToMap } from './navgraph-to-map.ts';
import { zonesToMap } from './zones-to-map.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:8c73497b */
import augurContract_5ff318de from '../../contracts/build-guide-map.contract.ts'; /* augur-inject:contract-predicate:54de9bc9 */

function convert(request: MapImportRequest): GuideMap {
  switch (request.kind) {
    case 'grid':
      return gridToMap(request);
    case 'navgraph':
      return navgraphToMap(request);
    case 'zones':
      return zonesToMap(request);
  }
}

function assertConnected(map: GuideMap, sourceName: string): void {
  const ids = new Set<string>();
  for (const node of map.nodes) {
    if (ids.has(node.id)) throw new ImportError(`${sourceName}: node ${node.id} is defined twice`);
    ids.add(node.id);
  }
  for (const edge of map.edges) {
    for (const end of [edge.from, edge.to]) if (!ids.has(end)) throw new ImportError(`${sourceName}: edge ${edge.from} -> ${edge.to} uses unknown node ${end}`);
  }
  for (const annotation of map.annotations) {
    if (!ids.has(annotation.target)) throw new ImportError(`${sourceName}: annotation targets unknown node ${annotation.target}`);
  }
}

export function buildGuideMap(request: MapImportRequest): GuideMap {
  const map = convert(request);
  assertConnected(map, request.sourceName);
  return map;
}
// @ts-expect-error augur-inject
buildGuideMap = contract(buildGuideMap, { ...augurContract_5ff318de, contractId: 'C-13', mode: 'observe', sample: 1, where: 'src/import/map/build-guide-map.ts:37', rule: 'contract-wrap', id: '5ff318de' }); /* augur-inject:contract-wrap:5ff318de */
