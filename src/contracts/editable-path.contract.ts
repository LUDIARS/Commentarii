// C-76 editablePath(raw): a path is editable only when it is bundle-relative (no absolute path,
// no drive letter, no empty / . / .. segment) and the bundle loader classifies it as a document;
// the schema returned is the one of that document kind.

import { classifyPath, SCHEMA_OF_KIND } from '@ludiars/commentarii-sdk/bundle';
import type { EditablePath } from '../web/doc-path.ts';

export default {
  post: (result: EditablePath | undefined, raw: string | undefined) => {
    if (result === undefined) return true;
    if (raw === undefined) return 'a path without input';
    if (result.path.startsWith('/') || /^[A-Za-z]:/.test(result.path) || result.path.split('/').some((segment) => segment === '..' || segment === '.' || segment === '')) return `${result.path} escapes the bundle`;
    const pathClass = classifyPath(result.path);
    if (pathClass.type !== 'document') return `${result.path} is not a bundle document`;
    return SCHEMA_OF_KIND[pathClass.kind] === result.schema || `${result.path} got schema ${result.schema}`;
  },
};
