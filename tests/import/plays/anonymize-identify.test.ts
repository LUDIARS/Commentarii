import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { hashIdentifier, playerHash, runHash } from '../../../src/import/plays/hash-identifier.ts';
import { createIdentify } from '../../../src/import/plays/identify.ts';
import { ImportError } from '../../../src/import/import-error.ts';
import { resolvePlayerSalt } from '../../../src/import/plays/player-salt.ts';
import { isHumanOverlayPath } from '../../../src/import/plays/human-run-path.ts';

test('a player hash is the first 16 hex digits of HMAC-SHA256(salt, identifier)', () => {
  const expected = createHmac('sha256', 'salt-1').update('player-7781', 'utf8').digest('hex').slice(0, 16);
  assert.equal(playerHash('salt-1', 'player-7781'), expected);
  assert.equal(playerHash('salt-1', 'player-7781'), playerHash('salt-1', 'player-7781'));
  assert.notEqual(playerHash('salt-2', 'player-7781'), expected);
  assert.match(hashIdentifier('salt-1', 'x'), /^[0-9a-f]{16}$/);
});

test('a run hash depends on the player, so equal session IDs of two players differ', () => {
  assert.notEqual(runHash('salt', 'player-a', 's-1'), runHash('salt', 'player-b', 's-1'));
  assert.equal(runHash('salt', 'player-a', 's-1'), runHash('salt', 'player-a', 's-1'));
});

test('the salt comes from the argument, else the environment, and is required', () => {
  assert.equal(resolvePlayerSalt('from-arg', 'from-env'), 'from-arg');
  assert.equal(resolvePlayerSalt(undefined, 'from-env'), 'from-env');
  assert.throws(() => resolvePlayerSalt(undefined, undefined), ImportError);
  assert.throws(() => resolvePlayerSalt(undefined, ''), ImportError);
});

test('identify: the mapping table wins, then the masters ID rule, else unidentified', () => {
  const entityIds = new Set(['enemy:bestia:wire-spider', 'enemy:bestia:bazooka-beetle']);
  const identify = createIdentify({
    gameId: 'bestia',
    entityIds,
    table: { SPIDER_W: 'enemy:bestia:wire-spider' },
    masters: { kind: 'enemy', id: { column: 'name_en', slugify: true }, name: { en: 'name_en' } },
  });
  assert.equal(identify('SPIDER_W'), 'enemy:bestia:wire-spider');
  assert.equal(identify('Bazooka Beetle'), 'enemy:bestia:bazooka-beetle');
  assert.equal(identify('Unknown Thing'), undefined);
  assert.equal(createIdentify({ gameId: 'bestia', entityIds })('wire-spider'), undefined);
});

test('import plays may only write runs and candidates under observations/human/', () => {
  assert.equal(isHumanOverlayPath('observations/human/0123456789abcdef/human-0123456789abcdef.jsonl'), true);
  assert.equal(isHumanOverlayPath('observations/human/candidates.json'), true);
  assert.equal(isHumanOverlayPath('tactics/kite-wire-spider.json'), false);
  assert.equal(isHumanOverlayPath('observations/human/Taro/run.jsonl'), false);
  assert.equal(isHumanOverlayPath('observations/runs/x.jsonl'), false);
});
