// guide verify intent --accept <id> --by <name>: the one command that writes the canonical
// intent/ (spec/feature/intent-verify.md 1.2). The new intent is schema-checked before anything
// is written; promotion of learned tactics is reported, never applied.

import { EXIT_OK } from '../../cli/cli-io.ts';
import { document, table } from '../../markdown/markdown.ts';
import { acceptDivergence } from '../intent/accept-divergence.ts';
import { DIVERGENCES_PATH } from '../intent/divergence-store.ts';
import { VerifyError } from '../verify-error.ts';
import { readDivergenceStore, serializeChecked } from './read-documents.ts';
import type { VerifyAcceptCommand } from './verify-command.ts';
import type { VerifyIo } from './verify-io.ts';
import type { VerifyCliIo } from './run-verify-intent.ts';

export async function runVerifyAccept(command: VerifyAcceptCommand, io: VerifyCliIo, verifyIo: VerifyIo): Promise<number> {
  const load = await io.openBundle(command.gameDir);
  const registry = await verifyIo.schemaRegistry();
  const store = await readDivergenceStore(verifyIo, command.gameDir, registry);
  if (store === undefined) throw new VerifyError(`${DIVERGENCES_PATH} does not exist; run guide verify intent --runs ... first`);
  const result = acceptDivergence({
    store,
    intents: load.bundle.intents.map(({ doc }) => doc),
    tactics: load.bundle.tactics.map(({ doc }) => doc),
    id: command.id,
    by: command.by,
    ...(command.note === undefined ? {} : { note: command.note }),
    ...(load.bundle.manifest?.doc.version === undefined ? {} : { manifestVersion: load.bundle.manifest.doc.version }),
  });
  const located = load.bundle.intents.find(({ doc }) => doc === result.before);
  if (located === undefined) throw new VerifyError(`no intent file for ${result.entry.stage}`);
  const violations = registry.validate('intent', result.intent);
  if (violations.length > 0) throw new VerifyError(`accepting ${command.id} would make ${located.path} invalid: ${violations.map((v) => `${v.pointer} ${v.message}`).join('; ')}`);
  const files = new Map<string, string>([[DIVERGENCES_PATH, serializeChecked(result.store, 'divergences', registry)]]);
  if (result.changed) files.set(located.path, `${JSON.stringify(result.intent, null, 2)}\n`);
  await io.writeFiles(command.gameDir, files);
  const summary = { accepted: command.id, decided_by: command.by, intent_path: located.path, intent_changed: result.changed, promotions: result.promotions };
  io.stdout(
    command.json
      ? `${JSON.stringify(summary, null, 2)}\n`
      : document([
          `# ズレの許容: ${command.id}`,
          `- 判定者: ${command.by}\n- ${result.changed ? `${located.path} の allowed_divergences に追加した` : `${located.path} は既にこのズレを許容している (変更なし)`}\n- 内容: ${result.entry.summary}`,
          result.promotions.length === 0
            ? 'learned → authored の昇格候補はありません。'
            : `## learned → authored の昇格候補 (自動では昇格しない)\n\n${table(['定石', '由来'], result.promotions.map((promotion) => [promotion.tactic, promotion.origin === 'bundle' ? '攻略本の learned 定石' : '探索の変種']))}`,
        ]),
  );
  io.stderr(`guide verify intent --accept: ${command.id} allowed by ${command.by}; wrote ${files.size} file(s)\n`);
  return EXIT_OK;
}
