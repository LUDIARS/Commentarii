// JSON text of an import input (mapping, master table, map file) -> data, BOM tolerated.

import { ImportError } from './import-error.ts';

const BYTE_ORDER_MARK = '﻿';

export function parseJsonInput(text: string, fileName: string): unknown {
  try {
    return JSON.parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text);
  } catch (cause) {
    throw new ImportError(`${fileName} is not valid JSON: ${(cause as Error).message}`);
  }
}
