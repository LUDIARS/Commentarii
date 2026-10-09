// Anonymization of play logs (design 10, 14.D): a raw identifier becomes the first 16 hex
// digits of HMAC-SHA256(salt, identifier). Same identifier + same salt -> same hash; the raw
// identifier is never written anywhere.

import { createHmac } from 'node:crypto';
import { contract } from '#contract-runtime'; /* augur-inject:import:26edc295 */
import augurContract_1b545002 from '../../contracts/hash-identifier.contract.ts'; /* augur-inject:contract-predicate:eddecb70 */

export const HASH_LENGTH = 16;

export function hashIdentifier(salt: string, identifier: string): string {
  return createHmac('sha256', salt).update(identifier, 'utf8').digest('hex').slice(0, HASH_LENGTH);
}
// @ts-expect-error augur-inject
hashIdentifier = contract(hashIdentifier, { ...augurContract_1b545002, contractId: 'C-43', mode: 'observe', sample: 1, where: 'src/import/plays/hash-identifier.ts:9', rule: 'contract-wrap', id: '1b545002' }); /* augur-inject:contract-wrap:1b545002 */

/** Hash of the player: the HMAC of the raw identifier itself, so another tool can reproduce it. */
export function playerHash(salt: string, player: string): string {
  return hashIdentifier(salt, player);
}

/** Hash of one run: the session identifier is only unique per player, so both go in. */
export function runHash(salt: string, player: string, run: string): string {
  return hashIdentifier(salt, `run\u0000${player}\u0000${run}`);
}
