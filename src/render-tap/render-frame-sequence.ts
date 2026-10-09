// Stream invariants of a render tap (spec/feature/render-tap-contract.md §3), checked line by
// line by the receiver. Problems are reported, not repaired: a lost frame stays lost and an
// instance handle reused without a new generation cannot be told apart from the old object.
//   loss            seq jumped: the tap dropped whole frames (backpressure)
//   frame-order     frame index did not increase
//   time-order      t or tick went back
//   instance-reuse  a handle now draws another appearance under the same generation
//   generation      a handle's generation went back
//   after-end       a line after the end line
//   disconnect      the stream closed without an end line (reported by close())

import { appearanceKey } from './identify-appearance.ts';
import { isTapEnd, type TapFrame, type TapLine } from './render-frame.ts';

export type SequenceProblemCode = 'loss' | 'frame-order' | 'time-order' | 'instance-reuse' | 'generation' | 'after-end' | 'disconnect';

export interface SequenceProblem {
  readonly code: SequenceProblemCode;
  readonly seq: number;
  readonly message: string;
}

export interface RenderFrameSequence {
  accept(line: TapLine): SequenceProblem[];
  /** The stream closed: a disconnect unless the end line came. */
  close(): SequenceProblem[];
}

interface InstanceState {
  readonly generation: number;
  readonly appearance: string;
}

export function createRenderFrameSequence(): RenderFrameSequence {
  let previous: TapFrame | undefined;
  let lastSeq: number | undefined;
  let ended = false;
  const instances = new Map<number, InstanceState>();

  const instanceProblems = (frame: TapFrame): SequenceProblem[] => {
    const problems: SequenceProblem[] = [];
    for (const pass of frame.passes) {
      for (const draw of pass.draws) {
        const appearance = appearanceKey(draw.mesh, draw.material);
        const known = instances.get(draw.instance);
        if (known !== undefined && draw.generation < known.generation) {
          problems.push({ code: 'generation', seq: frame.seq, message: `instance ${draw.instance} generation went back from ${known.generation} to ${draw.generation}` });
        } else if (known !== undefined && draw.generation === known.generation && known.appearance !== appearance) {
          problems.push({ code: 'instance-reuse', seq: frame.seq, message: `instance ${draw.instance} draws another appearance without a new generation` });
        }
        instances.set(draw.instance, { generation: Math.max(draw.generation, known?.generation ?? 0), appearance });
      }
    }
    return problems;
  };

  return {
    accept(line) {
      if (ended) return [{ code: 'after-end', seq: line.seq, message: 'line after the end of the stream' }];
      const problems: SequenceProblem[] = [];
      if (lastSeq !== undefined && line.seq !== lastSeq + 1) {
        problems.push({ code: 'loss', seq: line.seq, message: line.seq > lastSeq + 1 ? `${line.seq - lastSeq - 1} frame(s) lost before seq ${line.seq}` : `seq ${line.seq} does not follow ${lastSeq}` });
      }
      lastSeq = line.seq;
      if (isTapEnd(line)) {
        ended = true;
        return problems;
      }
      if (previous !== undefined) {
        if (line.frame <= previous.frame) problems.push({ code: 'frame-order', seq: line.seq, message: `frame ${line.frame} does not follow ${previous.frame}` });
        if (line.t < previous.t) problems.push({ code: 'time-order', seq: line.seq, message: `t ${line.t} goes back from ${previous.t}` });
        if (line.tick !== undefined && previous.tick !== undefined && line.tick < previous.tick) {
          problems.push({ code: 'time-order', seq: line.seq, message: `tick ${line.tick} goes back from ${previous.tick}` });
        }
      }
      problems.push(...instanceProblems(line));
      previous = line;
      return problems;
    },
    close() {
      return ended ? [] : [{ code: 'disconnect', seq: lastSeq ?? -1, message: 'the stream closed without an end line' }];
    },
  };
}
