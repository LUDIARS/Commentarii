// Excubitor data-import: node scripts/site/import-data.mjs --input <absolute path> --sha256 <64 hex>
// Verifies digest, owner service and format version of the empty data format. Commentarii
// keeps no persistent state, so verification is the whole import: nothing is extracted and
// nothing existing is overwritten, which also makes a partial failure impossible.

import { createHash, timingSafeEqual } from 'node:crypto';
import { lstat, open } from 'node:fs/promises';
import { assertEmptyBundle, MAX_BUNDLE_BYTES, parseArguments } from './data-bundle.mjs';

try {
  const args = parseArguments(process.argv.slice(2), ['--input', '--sha256']);
  if (!/^[a-f0-9]{64}$/i.test(args['--sha256'])) throw new Error('--sha256 must be 64 hex digits');
  const linkInfo = await lstat(args['--input']);
  if (!linkInfo.isFile() || linkInfo.isSymbolicLink() || linkInfo.size > MAX_BUNDLE_BYTES) throw new Error('input is not a small regular file');
  const file = await open(args['--input'], 'r');
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > MAX_BUNDLE_BYTES || info.dev !== linkInfo.dev || info.ino !== linkInfo.ino) throw new Error('input changed while reading');
    const buffer = Buffer.alloc(MAX_BUNDLE_BYTES + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead !== info.size) throw new Error('input changed while reading');
    const bytes = buffer.subarray(0, bytesRead);
    const digest = createHash('sha256').update(bytes).digest();
    if (!timingSafeEqual(digest, Buffer.from(args['--sha256'], 'hex'))) throw new Error('sha256 mismatch');
    assertEmptyBundle(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } finally {
    await file.close();
  }
} catch (error) {
  process.stderr.write(`commentarii data import failed: ${error.message}\n`);
  process.exitCode = 1;
}
