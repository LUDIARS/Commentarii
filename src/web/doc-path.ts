// Which file the editor may read or write: a bundle-relative document path the bundle loader
// itself recognizes (classifyPath), never an absolute path, never one that climbs out with
// "..", never observations/ or anything the loader ignores. Masked companions are documents too:
// the editor is the maker's own local tool (it never serves the player export).

import { classifyPath, SCHEMA_OF_KIND } from '../bundle/classify-path.ts';
import type { DocumentSchemaName } from '../schema/schema-names.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:16e475ce */
import augurContract_1b098ee1 from '../contracts/editable-path.contract.ts'; /* augur-inject:contract-predicate:fe2e243d */

export interface EditablePath {
  readonly path: string;
  readonly schema: DocumentSchemaName;
}

export function editablePath(raw: string | undefined): EditablePath | undefined {
  if (raw === undefined || raw === '') return undefined;
  const path = raw.replaceAll('\\', '/');
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split('/').some((segment) => segment === '..' || segment === '.' || segment === '')) return undefined;
  const pathClass = classifyPath(path);
  return pathClass.type === 'document' ? { path, schema: SCHEMA_OF_KIND[pathClass.kind] } : undefined;
}
// @ts-expect-error augur-inject
editablePath = contract(editablePath, { ...augurContract_1b098ee1, contractId: 'C-76', mode: 'observe', sample: 1, where: 'src/web/doc-path.ts:14', rule: 'contract-wrap', id: '1b098ee1' }); /* augur-inject:contract-wrap:1b098ee1 */
