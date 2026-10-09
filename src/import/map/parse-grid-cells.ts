// Grid map file -> CellMatrix. A .json file is a 2-D array (cells are strings or numbers);
// anything else is text, one row per line and one cell per character. Trailing blank lines
// are dropped; rows may be ragged (missing cells are not walkable).

import { ImportError } from '../import-error.ts';
import { parseJsonInput } from '../parse-json-input.ts';
import type { CellMatrix } from './map-request.ts';

const BYTE_ORDER_MARK = '﻿';

function fromJson(text: string, fileName: string): CellMatrix {
  const data = parseJsonInput(text, fileName);
  if (!Array.isArray(data)) throw new ImportError(`${fileName} must be a JSON array of rows`);
  return data.map((row: unknown, y) => {
    if (!Array.isArray(row)) throw new ImportError(`${fileName} row ${y + 1} is not an array`);
    return row.map((cell: unknown, x) => {
      if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
      throw new ImportError(`${fileName} row ${y + 1} column ${x + 1} is neither a string nor a number`);
    });
  });
}

function fromText(text: string): CellMatrix {
  const lines = (text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text).split(/\r?\n/);
  while (lines.length > 0 && lines.at(-1)?.trim() === '') lines.pop();
  return lines.map((line) => [...line]);
}

export function parseGridCells(text: string, fileName: string): CellMatrix {
  const cells = fileName.toLowerCase().endsWith('.json') ? fromJson(text, fileName) : fromText(text);
  if (!cells.some((row) => row.length > 0)) throw new ImportError(`${fileName} has no cells`);
  return cells;
}
