// A duplex channel of text lines over a pair of byte streams (the adapter protocol's
// transport). UTF-8 both ways, LF-terminated on write; a trailing CR on read is dropped so a
// game writing CRLF still parses. The data stream carries protocol lines only: diagnostics
// belong on stderr (coding conventions 5).

import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

export interface LineChannel {
  /** The next line, or undefined once the input has ended. */
  readLine(): Promise<string | undefined>;
  writeLine(line: string): Promise<void>;
  /** Stops reading; the streams themselves stay owned by whoever opened them. */
  close(): void;
}

export function createStreamLineChannel(input: Readable, output: Writable): LineChannel {
  input.setEncoding('utf8');
  const reader = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY, terminal: false });
  const lines = reader[Symbol.asyncIterator]();
  return {
    async readLine() {
      const next = await lines.next();
      return next.done === true ? undefined : next.value.replace(/\r$/, '');
    },
    writeLine(line) {
      return new Promise((resolve, reject) => {
        output.write(`${line}\n`, 'utf8', (error) => (error ? reject(error) : resolve()));
      });
    },
    close() {
      reader.close();
    },
  };
}
