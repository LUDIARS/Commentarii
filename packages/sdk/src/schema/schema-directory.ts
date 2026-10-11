// Where the bundled JSON Schemas (packages/sdk/schema/*.json) are on disk. The SDK owns the
// schemas, so readers in either repository find them through here rather than walking up
// from their own module. src/ and the compiled dist/ sit at the same depth in the package.

import { fileURLToPath } from 'node:url';
import { contract } from '#contract-runtime'; /* augur-inject:import:73a5c719 */
import augurContract_6cb0ffca from '../contracts/schema-directory.contract.ts'; /* augur-inject:contract-predicate:9fa5d595 */

/** Absolute path of the SDK's schema/ directory. */
export function schemaDirectory(): string {
  return fileURLToPath(new URL('../../schema', import.meta.url));
}
// @ts-expect-error augur-inject
schemaDirectory = contract(schemaDirectory, { ...augurContract_6cb0ffca, contractId: 'C-90', mode: 'observe', sample: 1, where: 'packages/sdk/src/schema/schema-directory.ts:8', rule: 'contract-wrap', id: '6cb0ffca' }); /* augur-inject:contract-wrap:6cb0ffca */
