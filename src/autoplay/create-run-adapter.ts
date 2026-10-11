// The adapter `guide run --adapter <kind>` plays through: the sim, a game over the stdio
// protocol, or a render tap stream (frames in through --frames, actions out through --act).
// The render tap's entity index is built from the player export only: what a player cannot
// know (masked entities) cannot be recognized on screen either.

import type { GameAdapter } from '../adapter/game-adapter.ts';
import { createRenderTapAdapter } from '../adapters/render-tap/render-tap-adapter.ts';
import { renderTapConfigOf } from '../adapters/render-tap/render-tap-config.ts';
import { createSimAdapter } from '../adapters/sim/sim-adapter.ts';
import { createStdioAdapter } from '../adapters/stdio/stdio-adapter.ts';
import type { Bundle } from '@ludiars/commentarii-sdk/types';
import { toPlayerView } from '@ludiars/commentarii-sdk/rulebook';
import type { EngineIo } from '../cli/engine-io.ts';
import { deriveSeed } from '../engine/rng.ts';
import { buildSignatureIndex } from '../render-tap/identify-appearance.ts';
import type { SchemaRegistry } from '@ludiars/commentarii-sdk/schemas';
import type { RunCommand } from './autoplay-command.ts';

export interface RunAdapterInput {
  readonly command: RunCommand;
  readonly bundle: Bundle;
  readonly gameId: string;
  readonly engineIo: EngineIo;
  readonly registry: () => Promise<SchemaRegistry>;
  readonly diagnostic: (text: string) => void;
}

function stageOf(bundle: Bundle, requested: string | undefined): { id: string; map?: Bundle['stages'][number]['map'] } {
  const stages = bundle.stages.map((stage) => ({ id: stage.stage?.doc.id ?? stage.map?.doc.stage, map: stage.map }));
  const found = requested === undefined ? stages.find((stage) => stage.id !== undefined) : stages.find((stage) => stage.id === requested);
  if (found?.id === undefined) throw new Error(requested === undefined ? 'the bundle has no stage for the render tap' : `no stage ${requested} in the bundle`);
  return { id: found.id, ...(found.map === undefined ? {} : { map: found.map }) };
}

async function renderTapAdapter(input: RunAdapterInput): Promise<GameAdapter> {
  const { command, bundle, engineIo } = input;
  if (command.framesPath === undefined) throw new Error('--adapter render-tap needs --frames <frames.jsonl|->');
  if (engineIo.openFrameSource === undefined) throw new Error('guide run: no frame source is wired (main.ts must provide openFrameSource)');
  const view = toPlayerView(bundle);
  const signatures = buildSignatureIndex(
    view.entities.flatMap(({ doc }) => (doc.render_signature === undefined ? [] : [{ entity: doc.id, ...((doc.render_signature.mesh ?? doc.render_signature.sprite) === undefined ? {} : { mesh: doc.render_signature.mesh ?? doc.render_signature.sprite }), ...(doc.render_signature.material === undefined ? {} : { material: doc.render_signature.material }) }])),
  );
  const stage = stageOf(bundle, command.stageId);
  const registry = await input.registry();
  const frames = engineIo.openFrameSource(command.framesPath);
  // Frames from stdin and actions to stdout share one channel (one reader on stdin).
  const actions = command.act !== 'stdio' ? undefined : command.framesPath === '-' ? frames : engineIo.openStdioChannel();
  return createRenderTapAdapter({
    gameId: input.gameId,
    frames,
    ...(actions === undefined ? {} : { actions }),
    context: { stageId: stage.id, ...(stage.map === undefined ? {} : { map: stage.map.doc }), purpose: command.purpose, config: renderTapConfigOf(bundle.manifest?.doc), signatures },
    validate: (line) => registry.validate('render-frame', line).map((violation) => `${violation.pointer} ${violation.message}`),
    onProblem: (problem) => input.diagnostic(`guide run: render tap ${problem.code} at seq ${problem.seq}: ${problem.message}\n`),
  });
}

export async function createRunAdapter(input: RunAdapterInput): Promise<GameAdapter> {
  const { command, bundle } = input;
  if (command.adapter === 'sim') return createSimAdapter({ bundle, mode: command.mode, purpose: command.purpose, seed: deriveSeed(command.seed, 'sim') });
  if (command.adapter === 'stdio') return createStdioAdapter(input.engineIo.openStdioChannel());
  if (command.mode !== 'player') throw new Error('--adapter render-tap observes the screen: --mode player only');
  return renderTapAdapter(input);
}
