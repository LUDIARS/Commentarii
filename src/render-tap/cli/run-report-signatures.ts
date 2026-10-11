// Runs `guide report signatures`: reads recorded render-tap/1 frames (schema-checked, end lines
// skipped), indexes the full guide's render_signature (the maker sees masked entities too: this is
// internal material), and reports the visible appearances nothing in the guide names.

import { basename, dirname } from 'node:path';
import { EXIT_INVALID, EXIT_OK, type CliIo } from '../../cli/cli-io.ts';
import { buildSignatureIndex } from '../identify-appearance.ts';
import { collectUnknownSignatures } from '../collect-unknown-signatures.ts';
import { formatSignatureReport } from '../format-signature-report.ts';
import { isTapEnd, type TapFrame, type TapLine } from '../render-frame.ts';
import type { ReportSignaturesCommand } from './report-signatures-command.ts';

type SignaturesIo = Pick<CliIo, 'stdout' | 'stderr' | 'openBundle' | 'writeFiles' | 'engineIo' | 'importIo'>;

async function readFrames(command: ReportSignaturesCommand, io: SignaturesIo): Promise<TapFrame[] | string> {
  const open = io.engineIo?.openFrameSource;
  if (open === undefined) return 'no frame source in this environment';
  const registry = await io.importIo.schemaRegistry();
  const channel = open(command.framesPath);
  const frames: TapFrame[] = [];
  try {
    for (let number = 1; ; number += 1) {
      const text = await channel.readLine();
      if (text === undefined) break;
      if (text.trim() === '') continue;
      let line: unknown;
      try {
        line = JSON.parse(text);
      } catch {
        return `line ${number} is not JSON`;
      }
      const problems = registry.validate('render-frame', line);
      if (problems.length > 0) return `line ${number} breaks render-tap/1: ${problems.map((p) => `${p.pointer} ${p.message}`).join('; ')}`;
      if (!isTapEnd(line as TapLine)) frames.push(line as TapFrame);
    }
  } finally {
    channel.close();
  }
  return frames;
}

export async function runReportSignatures(command: ReportSignaturesCommand, io: SignaturesIo): Promise<number> {
  const frames = await readFrames(command, io);
  if (typeof frames === 'string') {
    io.stderr(`guide report signatures: ${command.framesPath}: ${frames}\n`);
    return EXIT_INVALID;
  }
  const load = await io.openBundle(command.gameDir);
  const signatures = buildSignatureIndex(
    load.bundle.entities.flatMap(({ doc }) => {
      const mesh = doc.render_signature?.mesh ?? doc.render_signature?.sprite;
      if (doc.render_signature === undefined) return [];
      return [{ entity: doc.id, ...(mesh === undefined ? {} : { mesh }), ...(doc.render_signature.material === undefined ? {} : { material: doc.render_signature.material }) }];
    }),
  );
  const report = collectUnknownSignatures(frames, signatures);
  const text = command.json ? `${JSON.stringify(report, null, 2)}\n` : formatSignatureReport(report, load.bundle.manifest?.doc.game_id ?? command.gameDir);
  if (command.outFile === undefined) io.stdout(text);
  else await io.writeFiles(dirname(command.outFile), new Map([[basename(command.outFile), text]]));
  io.stderr(`guide report signatures: ${report.appearances.length} unnamed appearance(s) in ${report.frames_read} frame(s)\n`);
  return EXIT_OK;
}
