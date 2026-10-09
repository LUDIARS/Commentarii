// Telemetry row -> the abstract action of that tick (design 7.3). The input cell picks a verb
// from the mapping; the operand is an entity instance number, a position, or a game identifier
// / node resolved to a guide ID. An empty or unmapped input, or an operand that does not
// resolve, records `wait 0` (counted), so no raw game string reaches the action.

import type { ActionOperand, ReplayAction } from '../../replay/replay-action.ts';
import type { MasterRow } from '../masters/master-table.ts';
import { readText } from '../masters/read-cell.ts';
import { countIn, type ImportTally } from './import-tally.ts';
import type { PlaysMapping, VerbMapping } from './plays-mapping.ts';
import { readCount, readVector } from './read-row-values.ts';

/** Game identifier or node cell -> guide ID, or undefined. */
export type ResolveOperand = (cell: string) => string | undefined;

const WAIT: ReplayAction = { wait: 0 };

function readOperand(row: MasterRow, verb: VerbMapping, resolve: ResolveOperand): ActionOperand | undefined | 'unresolved' {
  if (verb.operand_pos !== undefined) {
    const pos = readVector(row, verb.operand_pos);
    if (pos !== undefined) return pos;
  }
  if (verb.operand === undefined) return undefined;
  const cell = row.cells[verb.operand];
  if (typeof cell === 'number') return readCount(row, verb.operand);
  const text = readText(row, verb.operand);
  if (text === undefined) return undefined;
  if (/^\d+$/.test(text)) return readCount(row, verb.operand);
  return resolve(text) ?? 'unresolved';
}

export function readAction(row: MasterRow, mapping: PlaysMapping['action'], resolve: ResolveOperand, tally: ImportTally): ReplayAction {
  if (mapping === undefined) return WAIT;
  const input = readText(row, mapping.column);
  if (input === undefined) return WAIT;
  const verb = mapping.verbs[input];
  if (verb === undefined) {
    countIn(tally, 'unmapped inputs');
    return WAIT;
  }
  if (verb.verb === 'wait') return { wait: verb.seconds ?? 0 };
  const operand = readOperand(row, verb, resolve);
  if (operand === 'unresolved') {
    countIn(tally, 'unresolved action operands');
    return WAIT;
  }
  if (verb.verb === 'custom') return { custom: verb.custom ?? 'custom', ...(operand === undefined ? {} : { target: operand }) };
  if (operand === undefined) {
    countIn(tally, 'actions without operand');
    return WAIT;
  }
  return { [verb.verb]: operand };
}
