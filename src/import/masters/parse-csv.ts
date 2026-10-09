// CSV master table (RFC 4180: header row, double-quoted fields, CRLF or LF) -> MasterTable.
// Row n of source.ref counts data records from 1; blank lines are not records.

import { ImportError } from '../import-error.ts';
import { tableNameOf, type MasterRow, type MasterTable } from './master-table.ts';

const BYTE_ORDER_MARK = '﻿';

/** Splits CSV text into records of raw fields. */
export function parseCsvRecords(text: string, fileName: string): string[][] {
  const source = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;
  const endField = (): void => {
    record.push(field);
    field = '';
    fieldStarted = false;
  };
  const endRecord = (): void => {
    endField();
    if (!(record.length === 1 && record[0] === '')) records.push(record);
    record = [];
  };
  for (let at = 0; at < source.length; at += 1) {
    const char = source.charAt(at);
    if (quoted) {
      if (char !== '"') field += char;
      else if (source.charAt(at + 1) === '"') {
        field += '"';
        at += 1;
      } else quoted = false;
      continue;
    }
    if (char === '"' && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
    } else if (char === ',') endField();
    else if (char === '\n') endRecord();
    else if (char === '\r' && source.charAt(at + 1) === '\n') {
      endRecord();
      at += 1;
    } else {
      field += char;
      fieldStarted = true;
    }
  }
  if (quoted) throw new ImportError(`${fileName}: a quoted field is not closed`);
  if (field !== '' || record.length > 0) endRecord();
  return records;
}

export function parseCsvTable(text: string, fileName: string): MasterTable {
  const [header, ...records] = parseCsvRecords(text, fileName);
  if (header === undefined) throw new ImportError(`${fileName} has no header row`);
  const columns = header.map((column) => column.trim());
  const duplicate = columns.find((column, position) => column === '' || columns.indexOf(column) !== position);
  if (duplicate !== undefined) throw new ImportError(`${fileName}: header has an empty or duplicate column '${duplicate}'`);
  const rows: MasterRow[] = records.map((fields, position) => {
    const ref = `${fileName}#row=${position + 1}`;
    if (fields.length !== columns.length) throw new ImportError(`${ref}: ${fields.length} fields, header has ${columns.length}`);
    return { ref, cells: Object.fromEntries(columns.map((column, index) => [column, fields[index] ?? ''])) };
  });
  return { name: tableNameOf(fileName), columns, rows };
}
