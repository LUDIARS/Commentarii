import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clusterSolutions } from '../../src/verify/feasibility/cluster-solutions.ts';
import { KITE, trace } from '../support/verify.ts';

test('a failed partial attempt joins the solution whose route it starts', () => {
  const clusters = clusterSolutions('arena', [
    trace({ run: 'run:full', tactics: [KITE], route: ['node:a', 'node:b', 'node:c'] }),
    trace({ run: 'run:part', tactics: [KITE], route: ['node:a', 'node:b'], reached: false }),
    trace({ run: 'run:other', tactics: [KITE], route: ['node:a', 'node:d'] }),
    trace({ run: 'run:plain', tactics: [], route: ['node:a', 'node:b', 'node:c'] }),
  ], []);
  const members = clusters.map((cluster) => cluster.members.map((member) => member.run).sort());
  assert.deepEqual(members.sort(), [['run:full', 'run:part'], ['run:other'], ['run:plain']].sort());
  const full = clusters.find((cluster) => cluster.members.some((member) => member.run === 'run:full'));
  assert.deepEqual(full?.route, ['node:a', 'node:b', 'node:c']);
});

test('clustering does not depend on input order', () => {
  const traces = [
    trace({ run: 'run:1', tactics: [KITE], route: ['node:a', 'node:b'] }),
    trace({ run: 'run:2', tactics: [KITE], route: ['node:a'] }),
    trace({ run: 'run:3', tactics: [], route: ['node:a', 'node:c'] }),
  ];
  const shape = (list: typeof traces) => clusterSolutions('arena', list, []).map((cluster) => [cluster.id, cluster.members.map((member) => member.run)]);
  assert.deepEqual(shape([...traces].reverse()), shape(traces));
});

test('intended solutions nobody reproduced become empty solutions', () => {
  const clusters = clusterSolutions('arena', [trace({ run: 'run:1', route: ['node:a', 'node:b'] })], [
    { intent: 'intent:g:arena:route', tactics: [], route: ['node:a', 'node:z'] },
    { intent: 'intent:g:arena:route-ok', tactics: [], route: ['node:a', 'node:b'] },
  ]);
  assert.equal(clusters.length, 2);
  assert.deepEqual(clusters[0]?.intended, ['intent:g:arena:route-ok']);
  assert.deepEqual(clusters[1]?.members, []);
  assert.deepEqual(clusters[1]?.intended, ['intent:g:arena:route']);
});
