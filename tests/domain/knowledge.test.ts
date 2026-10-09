import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPlayerKnowable, strictestKnowledge } from '../../src/domain/knowledge.ts';

test('the strictest label wins', () => {
  assert.equal(strictestKnowledge(['shown', 'discoverable']), 'discoverable');
  assert.equal(strictestKnowledge(['shown', 'masked', 'discoverable']), 'masked');
  assert.equal(strictestKnowledge(['shown']), 'shown');
  assert.equal(strictestKnowledge([]), undefined);
});

test('only masked is hidden from the player', () => {
  assert.equal(isPlayerKnowable('shown'), true);
  assert.equal(isPlayerKnowable('discoverable'), true);
  assert.equal(isPlayerKnowable('masked'), false);
});
