
import { mkdir, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { writeOutputFiles } from './write-output-files.ts';

export async function writeLevelCopy(source: string, destination: string, files: ReadonlyMap<string, string>): Promise<void> {
  const original = await realpath(source);
  const requested = resolve(destination);
  const target = join(await realpath(dirname(requested)), basename(requested));
  const fromOriginal = relative(original, target);
  if (fromOriginal === '' || (!isAbsolute(fromOriginal) && fromOriginal !== '..' && !fromOriginal.startsWith(`..${sep}`))) {
    throw new Error('choose a new copy directory outside the canonical bundle');
  }
  await mkdir(target);
  await writeOutputFiles(target, files);
}
