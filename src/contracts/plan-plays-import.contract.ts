// C-40 planPlaysImport(request): every run is a human play (source human, mode player, purpose
// human) under observations/human/<player-hash>/ with no masked value anywhere; the player hash
// is HMAC-SHA256(salt, raw player identifier) cut to 16 hex digits, and no raw player or run
// identifier appears in any output text.

import { createHmac } from 'node:crypto';
import type { PlaysImport, PlaysImportRequest } from '../import/plays/plan-plays-import.ts';
import { readText } from '../import/masters/read-cell.ts';
import { findMaskedPointers } from '../replay/find-masked-pointers.ts';

const RUN_PATH = /^observations\/human\/([0-9a-f]{16})\/[a-z0-9][a-z0-9_-]*\.jsonl$/;

export default {
  post: (result: PlaysImport, request: PlaysImportRequest) => {
    const rawPlayers = new Set(request.table.rows.flatMap((row) => readText(row, request.mapping.player.column) ?? []));
    const rawRuns = new Set(request.table.rows.flatMap((row) => readText(row, request.mapping.run.column) ?? []));
    const expected = new Set([...rawPlayers].map((player) => createHmac('sha256', request.salt).update(player, 'utf8').digest('hex').slice(0, 16)));
    for (const file of result.runs) {
      const match = RUN_PATH.exec(file.path);
      if (!match || match[1] !== file.playerHash) return `${file.path} is not observations/human/<player-hash>/<run>.jsonl`;
      if (!expected.has(file.playerHash)) return `${file.path}: the player hash is not the HMAC of a raw player identifier`;
      const { header, ticks } = file.run;
      if (header.source !== 'human' || header.mode !== 'player' || header.purpose !== 'human') return `${file.path}: the header is not a human player run`;
      if (ticks.some((tick) => tick.observation.mode !== 'player' || tick.observation.purpose !== 'human')) return `${file.path}: an observation is not a human player observation`;
      if (findMaskedPointers(file.run).length > 0) return `${file.path} holds a masked value`;
      for (const raw of [...rawPlayers, ...rawRuns]) if (file.text.includes(JSON.stringify(raw))) return `${file.path} holds a raw player or run identifier`;
    }
    return true;
  },
};
