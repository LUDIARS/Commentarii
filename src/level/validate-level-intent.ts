
import type { SchemaRegistry } from '@ludiars/commentarii-sdk/schemas';
import type { Intent } from '@ludiars/commentarii-sdk/types';
import { contract } from '#contract-runtime'; /* augur-inject:import:e0fc349b */
import augurContract_f56896e0 from '../contracts/level-authoring-110.contract.ts'; /* augur-inject:contract-predicate:ea0d849d */

export function isLevelIntent(data: unknown, registry: SchemaRegistry): data is Intent {
  return registry.validate('intent', data).length === 0;
}
// @ts-expect-error augur-inject
isLevelIntent = contract(isLevelIntent, { ...augurContract_f56896e0, contractId: 'C-110', mode: 'observe', sample: 1, where: 'src/level/validate-level-intent.ts:5', rule: 'contract-wrap', id: 'f56896e0' }); /* augur-inject:contract-wrap:f56896e0 */
