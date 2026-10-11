// guide verify intent --reject <id> --by <name> [--note]: a person marks a divergence as not
// acceptable. Only observations/divergences.json changes (decision reject, decided_by, note): the
// canonical intent is never touched, and a rejected divergence keeps being reported, ordered
// after the pending ones (spec/feature/intent-verify.md 4.3).

import { EXIT_OK, type CliIo } from '../../cli/cli-io.ts';
import { DIVERGENCES_PATH, type DivergenceStore } from '../intent/divergence-store.ts';
import { VerifyError } from '../verify-error.ts';
import { readDivergenceStore, serializeChecked } from './read-documents.ts';
import type { VerifyAcceptCommand } from './verify-command.ts';
import type { VerifyIo } from './verify-io.ts';

type RejectIo = Pick<CliIo, 'stdout' | 'writeFiles'>;

export function rejectDivergence(store: DivergenceStore, id: string, by: string, note?: string): DivergenceStore {
  if (!store.divergences.some((entry) => entry.id === id)) throw new VerifyError(`divergence ${id} is not in ${DIVERGENCES_PATH} (run guide verify intent first)`);
  return {
    ...store,
    divergences: store.divergences.map((entry) => (entry.id === id ? { ...entry, decision: 'reject', decided_by: by, ...(note === undefined ? {} : { note }) } : entry)),
  };
}

export async function runVerifyReject(command: VerifyAcceptCommand, io: RejectIo, verifyIo: VerifyIo): Promise<number> {
  const registry = await verifyIo.schemaRegistry();
  const store = await readDivergenceStore(verifyIo, command.gameDir, registry);
  if (store === undefined) throw new VerifyError(`${DIVERGENCES_PATH} does not exist; run guide verify intent --runs ... first`);
  const next = rejectDivergence(store, command.id, command.by, command.note);
  await io.writeFiles(command.gameDir, new Map([[DIVERGENCES_PATH, serializeChecked(next, 'divergences', registry)]]));
  io.stdout(command.json ? `${JSON.stringify({ rejected: command.id, decided_by: command.by }, null, 2)}\n` : `# ズレの却下: ${command.id}\n\n- 判定者: ${command.by}\n- 正本 (intent) は変えていない。却下したズレは報告し続け、未判定の後に並ぶ。\n`);
  return EXIT_OK;
}
