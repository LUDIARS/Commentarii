import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GuideMap } from '../../src/domain/documents.ts';
import { drawHeatmap } from '../../src/render/heatmap/draw-heatmap.ts';
import { drawScatter } from '../../src/render/heatmap/draw-scatter.ts';
import { wellFormedProblems } from '../../src/render/heatmap/well-formed.ts';
import { aggregateHeatmap } from '../../src/verify/heatmap/aggregate-heatmap.ts';
import { loadSample } from '../support/bundles.ts';
import { fixtureTraces, MAIN_RUNS } from '../support/verify.ts';

const SOURCE = { kind: 'human' as const, ref: 'test' };

function count(svg: string, needle: string): number {
  return svg.split(needle).length - 1;
}

test('the well-formedness check catches broken XML', () => {
  assert.deepEqual(wellFormedProblems('<svg><g a="1"><rect/></g><text>a &amp; b</text></svg>'), []);
  assert.notDeepEqual(wellFormedProblems('<svg><g></svg>'), []);
  assert.notDeepEqual(wellFormedProblems('<svg><g a=1/></svg>'), []);
  assert.notDeepEqual(wellFormedProblems('<svg>a & b</svg>'), []);
  assert.notDeepEqual(wellFormedProblems('<svg/><svg/>'), []);
});

test('zones heatmap of the fixtures: well-formed, one panel per group, forbid and routes drawn', async () => {
  const load = await loadSample();
  const map = load.bundle.stages[0]?.map?.doc;
  assert.ok(map);
  const { traces } = await fixtureTraces(MAIN_RUNS);
  const panels = aggregateHeatmap(traces);
  assert.deepEqual(panels.map((panel) => panel.group), ['all', 'persona:expert', 'persona:explorer', 'persona:novice', 'human']);
  assert.equal(panels[0]?.nodes['node:outer-ring']?.deaths, 1, 'run:verify-fail-novice died on the outer ring');
  assert.equal(panels.find((panel) => panel.group === 'human')?.runs, 1);
  const svg = drawHeatmap({ title: 'dome <arena> & "test"', map, panels, overlay: { routes: [['node:mid-ring', 'node:center']], forbid: ['node:outside'] } });
  assert.deepEqual(wellFormedProblems(svg), []);
  assert.equal(count(svg, 'class="panel"'), 5);
  assert.equal(count(svg, 'class="forbid"'), 5, 'the forbid area in every panel');
  assert.equal(count(svg, 'class="intent-route"'), 5);
  assert.ok(count(svg, 'class="run-path"') > 0, 'run routes are drawn');
  assert.ok(count(svg, 'class="death"') > 0);
});

test('grid and navgraph maps are drawn as cells and circles', () => {
  const grid: GuideMap = {
    stage: 'stage:g:s',
    kind: 'grid',
    size: [2, 2],
    source: SOURCE,
    nodes: [
      { id: 'node:a', cell: [0, 0], knowledge: 'shown' },
      { id: 'node:b', cell: [1, 0], knowledge: 'shown' },
      { id: 'node:c', cell: [1, 1], knowledge: 'shown' },
    ],
    edges: [],
    annotations: [],
  };
  const panels = [{ group: 'all', runs: 1, nodes: { 'node:a': { visits: 1, dwellSec: 2, deaths: 0 }, 'node:b': { visits: 1, dwellSec: 1, deaths: 1 } }, moves: [{ from: 'node:a', to: 'node:b', count: 1 }] }];
  const gridSvg = drawHeatmap({ title: 'grid', map: grid, panels, overlay: { routes: [['node:a', 'node:c']], forbid: ['node:c'] } });
  assert.deepEqual(wellFormedProblems(gridSvg), []);
  assert.equal(count(gridSvg, 'class="node"'), 3, 'one cell per node');
  assert.equal(count(gridSvg, 'class="forbid"'), 1);
  const navgraph: GuideMap = { ...grid, kind: 'navgraph', nodes: grid.nodes.map((node, index) => ({ id: node.id, pos: [index * 10, index * 5], knowledge: 'shown' })), edges: [{ from: 'node:a', to: 'node:b', knowledge: 'shown' }] };
  const navSvg = drawHeatmap({ title: 'nav', map: navgraph, panels, overlay: { routes: [], forbid: ['node:c'] } });
  assert.deepEqual(wellFormedProblems(navSvg), []);
  assert.equal(count(navSvg, 'class="edge"'), 1);
  assert.ok(count(navSvg, '<circle fill=') >= 3);
  assert.equal(count(navSvg, 'class="run-path"'), 1);
});

test('the good-play scatter plot is well-formed with one point per stage x persona', () => {
  const svg = drawScatter('2 軸', [
    { stage: 'stage:g:a', persona: 'novice', breadth: 1, confusionDepth: 2.5 },
    { stage: 'stage:g:a', persona: 'expert', breadth: 3, confusionDepth: 0.5 },
  ]);
  assert.deepEqual(wellFormedProblems(svg), []);
  assert.equal(count(svg, 'class="point"'), 2);
  assert.equal(count(svg, 'class="legend"'), 2);
});
