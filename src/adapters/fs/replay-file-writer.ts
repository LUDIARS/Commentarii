// ReplayLineWriter over a file: creates replay/<run-id>.jsonl (refusing to reuse an existing
// file, which would splice two runs into one) and appends one UTF-8, LF-terminated line per call.

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ReplayLineWriter } from '../../replay/recording-sink.ts';

export async function createReplayFileWriter(path: string): Promise<ReplayLineWriter> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, '', { encoding: 'utf8', flag: 'wx' });
  return {
    async append(line) {
      await appendFile(path, `${line}\n`, 'utf8');
    },
  };
}
