// Telemetry file text -> rows, by extension: .jsonl (JSON Lines), .csv, .json (array of
// objects). The CSV and JSON readers are the ones guide import masters uses.

import { ImportError } from '../import-error.ts';
import type { MasterTable } from '../masters/master-table.ts';
import { parseCsvTable } from '../masters/parse-csv.ts';
import { parseJsonTable } from '../masters/parse-json-table.ts';
import { parseJsonlTable } from './parse-jsonl-table.ts';

const READERS: Readonly<Record<string, (text: string, fileName: string) => MasterTable>> = {
  '.jsonl': parseJsonlTable,
  '.csv': parseCsvTable,
  '.json': parseJsonTable,
};

export function readTelemetry(text: string, fileName: string): MasterTable {
  const dot = fileName.lastIndexOf('.');
  const reader = dot === -1 ? undefined : READERS[fileName.slice(dot).toLowerCase()];
  if (reader === undefined) throw new ImportError(`${fileName}: telemetry must be .jsonl, .csv or .json`);
  return reader(text, fileName);
}
