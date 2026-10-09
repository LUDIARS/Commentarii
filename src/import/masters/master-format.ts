// Format of a master data file, chosen by its extension.

import { ImportError } from '../import-error.ts';

export type MasterFormat = 'csv' | 'json' | 'sqlite';

const FORMATS: Readonly<Record<string, MasterFormat>> = {
  '.csv': 'csv',
  '.json': 'json',
  '.sqlite': 'sqlite',
  '.sqlite3': 'sqlite',
  '.db': 'sqlite',
};

export function masterFormatOf(fileName: string): MasterFormat {
  const dot = fileName.lastIndexOf('.');
  const format = dot === -1 ? undefined : FORMATS[fileName.slice(dot).toLowerCase()];
  if (format === undefined) throw new ImportError(`${fileName}: master data must be .csv, .json or SQLite (.sqlite / .sqlite3 / .db)`);
  return format;
}
