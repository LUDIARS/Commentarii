// V06: every value has a source (principle 3: no value without provenance enters the bundle).

import { findValueNodes, isJsonObject } from '../../domain/value-node.ts';
import { error, type Check, type Finding } from '../check.ts';

export const v06SourcePresent: Check = {
  id: 'V06',
  title: 'source 無しの値が無い',
  run: ({ load }) => {
    const findings: Finding[] = [];
    for (const file of load.files) {
      for (const { node, pointer } of findValueNodes(file.data)) {
        const source = node.source;
        if (!isJsonObject(source)) findings.push(error(file.path, pointer, 'value without source'));
        else if (typeof source.kind !== 'string' || typeof source.ref !== 'string' || source.ref === '') {
          findings.push(error(file.path, `${pointer}/source`, 'source needs kind and ref'));
        }
      }
    }
    return findings;
  },
};
