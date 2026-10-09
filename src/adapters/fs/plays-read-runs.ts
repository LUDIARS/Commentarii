// Reads the .jsonl run files under one overlay directory of a bundle on disk
// (observations/human/, observations/runs/) for guide import plays / guide report plays.

import type { PlayRunFile } from '../../import/plays/classify-play-runs.ts';
import { createFsBundleSource } from './fs-bundle-source.ts';

export async function readPlayRunFiles(bundleDir: string, directory: string): Promise<PlayRunFile[]> {
  const source = await createFsBundleSource(bundleDir);
  const paths = (await source.listFiles()).filter((path) => path.startsWith(`${directory}/`) && path.endsWith('.jsonl'));
  return Promise.all(paths.map(async (path) => ({ path, text: await source.readText(path) })));
}
