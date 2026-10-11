// A render tap frame stream as a line channel: a JSON Lines file, or - for the process's stdin.
// The channel only reads; anything written to it is discarded.

import { createReadStream } from 'node:fs';
import { PassThrough } from 'node:stream';
import { createStreamLineChannel, type LineChannel } from '../stdio/line-channel.ts';

export function openFrameSource(path: string): LineChannel {
  const input = path === '-' ? process.stdin : createReadStream(path);
  return createStreamLineChannel(input, new PassThrough());
}
