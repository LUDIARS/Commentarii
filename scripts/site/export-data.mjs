// Excubitor data-export: node scripts/site/export-data.mjs --output <absolute path>
// Writes the empty data format. Fails if the output already exists.

import { writeFile } from 'node:fs/promises';
import { emptyBundle, parseArguments } from './data-bundle.mjs';

try {
  const args = parseArguments(process.argv.slice(2), ['--output']);
  await writeFile(args['--output'], `${JSON.stringify(emptyBundle)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
} catch (error) {
  process.stderr.write(`commentarii data export failed: ${error.message}\n`);
  process.exitCode = 1;
}
