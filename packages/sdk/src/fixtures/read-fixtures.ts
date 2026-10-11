// Reads the SDK fixtures. A bundle fixture whose header does not say what was asked for (another
// format, format_version or knowledge) is refused rather than handed over: a test that silently
// reads a full export as a player one would stop guarding the mask.

import { readFile } from 'node:fs/promises';
import { EXPORT_FORMAT, EXPORT_FORMAT_VERSION, type ExportedBundle, type ExportKnowledge } from '../export/exported-bundle.ts';
import { fixtureBundlePath, fixtureReplayPath, type FixtureReplay } from './fixture-paths.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:644df96f */
import augurContract_13d0f7b8 from '../contracts/read-fixture-bundle.contract.ts'; /* augur-inject:contract-predicate:ed7fe443 */
import augurContract_a8b9fe29 from '../contracts/read-fixture-replay.contract.ts'; /* augur-inject:contract-predicate:2cddd58f */

export async function readFixtureBundle(knowledge: ExportKnowledge): Promise<ExportedBundle> {
  const path = fixtureBundlePath(knowledge);
  const bundle = JSON.parse(await readFile(path, 'utf8')) as Partial<ExportedBundle>;
  if (bundle.format !== EXPORT_FORMAT || bundle.format_version !== EXPORT_FORMAT_VERSION) {
    throw new Error(`${path} is not ${EXPORT_FORMAT} v${EXPORT_FORMAT_VERSION} (format ${String(bundle.format)}, format_version ${String(bundle.format_version)})`);
  }
  if (bundle.knowledge !== knowledge) throw new Error(`${path} holds a ${String(bundle.knowledge)} export, not ${knowledge}`);
  return bundle as ExportedBundle;
}
// @ts-expect-error augur-inject
readFixtureBundle = contract(readFixtureBundle, { ...augurContract_13d0f7b8, contractId: 'C-91', mode: 'observe', sample: 1, where: 'packages/sdk/src/fixtures/read-fixtures.ts:9', rule: 'contract-wrap', id: '13d0f7b8' }); /* augur-inject:contract-wrap:13d0f7b8 */

/** The replay fixture as JSON Lines text (parse it with parseReplay). */
export async function readFixtureReplay(name: FixtureReplay): Promise<string> {
  return readFile(fixtureReplayPath(name), 'utf8');
}
// @ts-expect-error augur-inject
readFixtureReplay = contract(readFixtureReplay, { ...augurContract_a8b9fe29, contractId: 'C-92', mode: 'observe', sample: 1, where: 'packages/sdk/src/fixtures/read-fixtures.ts:20', rule: 'contract-wrap', id: 'a8b9fe29' }); /* augur-inject:contract-wrap:a8b9fe29 */
