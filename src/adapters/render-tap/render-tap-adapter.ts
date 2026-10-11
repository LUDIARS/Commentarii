// GameAdapter over a render tap stream (design 7.1 route 2, spec/feature/render-tap-contract.md):
// frames (render-tap/1 lines) come in on one channel and become player Observations; actions go
// out on another channel (the stdio protocol's action lines) or nowhere (observe only). The tap
// only observes, so mode is always player. Lines that break the schema stop the run; stream
// problems (lost frames, reordering, handle reuse) are reported and the run goes on with the
// frames that did arrive; a stream that ends without an end line is a disconnect (abort).

import type { AdapterHello, GameAdapter, Observed } from '../../adapter/game-adapter.ts';
import { ProtocolError, serializeEngineMessage } from '../../adapter/protocol.ts';
import { isTapEnd, type TapLine } from '../../render-tap/render-frame.ts';
import { createRenderFrameSequence, type SequenceProblem } from '../../render-tap/render-frame-sequence.ts';
import type { LineChannel } from '../stdio/line-channel.ts';
import { tapToObservation, type TapContext } from './tap-to-observation.ts';

export const RENDER_TAP_ADAPTER_ID = 'render-tap';

export interface RenderTapAdapterOptions {
  readonly gameId: string;
  readonly frames: LineChannel;
  /** Where actions go (the stdio protocol's action lines); absent = observe only. */
  readonly actions?: LineChannel;
  readonly context: TapContext;
  /** Schema check of one parsed line (render-frame.schema.json); messages, empty when valid. */
  readonly validate: (line: unknown) => readonly string[];
  /** Stream problems (lost frames etc.): diagnostics, not protocol errors. */
  readonly onProblem: (problem: SequenceProblem) => void;
}

export function createRenderTapAdapter(options: RenderTapAdapterOptions): GameAdapter {
  const sequence = createRenderFrameSequence();
  let lastTick: number | undefined;
  let closed = false;

  const nextLine = async (): Promise<TapLine | undefined> => {
    for (;;) {
      const text = await options.frames.readLine();
      if (text === undefined) return undefined;
      if (text.trim() === '') continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new ProtocolError('a render tap line is not JSON');
      }
      const problems = options.validate(parsed);
      if (problems.length > 0) throw new ProtocolError(`a render tap line breaks render-tap/1: ${problems.join('; ')}`);
      return parsed as TapLine;
    }
  };

  return {
    async hello(): Promise<AdapterHello> {
      return { game_id: options.gameId, adapter_id: RENDER_TAP_ADAPTER_ID, mode: 'player' };
    },
    async observe(): Promise<Observed> {
      const line = await nextLine();
      if (line === undefined) {
        for (const problem of sequence.close()) options.onProblem(problem);
        return { type: 'end', end: { result: 'abort', summary: { stopped: 'tap-disconnected' } } };
      }
      for (const problem of sequence.accept(line)) options.onProblem(problem);
      if (isTapEnd(line)) return { type: 'end', end: { result: 'abort', summary: { stopped: `tap-${line.end}` } } };
      const frame = tapToObservation(line, options.context);
      lastTick = frame.tick;
      return { type: 'observation', frame };
    },
    async act(action) {
      if (lastTick === undefined) throw new ProtocolError('act() before any observation');
      await options.actions?.writeLine(serializeEngineMessage({ type: 'action', tick: lastTick, action }));
    },
    identify: () => undefined,
    async close() {
      if (closed) return;
      closed = true;
      options.frames.close();
      if (options.actions !== undefined && options.actions !== options.frames) options.actions.close();
    },
  };
}
