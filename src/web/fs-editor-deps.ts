// The editor's dependencies on the real file system: the bundle directory given at start-up,
// files read and written under it, the bundled schemas, and the guide CLI run in this process
// with its output captured (the same commands a person would type).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openBundleDir } from '../adapters/fs/open-bundle-dir.ts';
import { readSchemaDocuments } from '../adapters/fs/read-schema-documents.ts';
import { writeOutputFiles } from '../adapters/fs/write-output-files.ts';
import { createMainIo } from '../cli/main-io.ts';
import { runCli } from '../cli/run-cli.ts';
import { createSchemaRegistry } from '@ludiars/commentarii-sdk/schemas';
import type { EditorDeps } from './editor-api.ts';

export function createFsEditorDeps(bundleDir: string, port: number): EditorDeps {
  return {
    bundleDir,
    origins: [`http://127.0.0.1:${port}`, `http://localhost:${port}`],
    openBundle: () => openBundleDir(bundleDir),
    async readText(relativePath) {
      try {
        return await readFile(join(bundleDir, ...relativePath.split('/')), 'utf8');
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw cause;
      }
    },
    writeFile: (relativePath, text) => writeOutputFiles(bundleDir, new Map([[relativePath, text]])),
    registry: async () => createSchemaRegistry(await readSchemaDocuments()),
    async runCli(args) {
      let stdout = '';
      let stderr = '';
      const code = await runCli([...args], createMainIo({ stdout: (text) => void (stdout += text), stderr: (text) => void (stderr += text) }));
      return { code, stdout, stderr };
    },
  };
}
