// Excubitor setup: install dependencies, typecheck, build dist/ (npm run dev serves dist/health).
// Re-runnable; owns no data and no secrets. Does not start the service.

import { fileURLToPath } from 'node:url';
import { runNpm } from './npm.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

try {
  await runNpm(root, ['ci', '--include=dev', '--no-audit', '--no-fund']);
  await runNpm(root, ['run', 'typecheck']);
  await runNpm(root, ['run', 'build']);
} catch (error) {
  process.stderr.write(`commentarii setup failed: ${error.message}\n`);
  process.exitCode = 1;
}
