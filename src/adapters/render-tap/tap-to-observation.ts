// One render tap frame -> one player Observation (design 7.2, source render-tap;
// spec/feature/render-tap-contract.md §6, §8). Built from selectPlayerDraws alone: draws the
// player camera could not be shown to have seen never get here, and renderer asset IDs never
// leave the selection. An instance whose appearance names no single entity (unknown signature,
// ambiguous look-alike, count-hash) is observed without an entity ID, which reflect records as
// an unknown entity. UI bars and numbers go to the places manifest render_tap.ui names.

import type {
  GuideMap,
  ObservationFrame,
  ObservationPurpose,
  ObservedEntity,
  ObservedValue,
  Vector3,
} from '@ludiars/commentarii-sdk/types';
import { appearanceKey } from '../../render-tap/identify-appearance.ts';
import type { Matrix4, TapFrame } from '../../render-tap/render-frame.ts';
import { selectPlayerDraws, type SeenInstance, type SeenUi } from '../../render-tap/select-player-draws.ts';
import type { RenderTapConfig } from './render-tap-config.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:7e40bc72 */
import augurContract_32f2ba67 from '../../contracts/tap-to-observation.contract.ts'; /* augur-inject:contract-predicate:b628a795 */

export interface TapContext {
  readonly stageId: string;
  readonly map?: GuideMap;
  readonly purpose: ObservationPurpose;
  readonly config: RenderTapConfig;
  /** Appearance key -> entity IDs (render_signature index of the player export). */
  readonly signatures: ReadonlyMap<string, readonly string[]>;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000 || 0;
}

/** Camera position in the world: -R^T t of a column-major view matrix. */
export function cameraPosition(view: Matrix4): Vector3 {
  const m = (index: number): number => view[index] ?? 0;
  const [tx, ty, tz] = [m(12), m(13), m(14)];
  return [round(-(m(0) * tx + m(1) * ty + m(2) * tz)), round(-(m(4) * tx + m(5) * ty + m(6) * tz)), round(-(m(8) * tx + m(9) * ty + m(10) * tz))];
}

function nearestNode(map: GuideMap | undefined, pos: Vector3): string | undefined {
  let best: { id: string; distance: number } | undefined;
  for (const node of map?.nodes ?? []) {
    if (node.pos === undefined || node.pos.length < 2) continue;
    const [x = 0, a = 0, b] = node.pos;
    const z = b ?? a;
    const y = b === undefined ? 0 : a;
    const distance = Math.hypot(pos[0] - x, pos[1] - y, pos[2] - z);
    if (best === undefined || distance < best.distance) best = { id: node.id, distance };
  }
  return best?.id;
}

function entityOf(seen: SeenInstance): ObservedEntity {
  return { ...(seen.entity === undefined ? {} : { entity: seen.entity }), instance: seen.instance, pos: seen.pos, screen: seen.screen, confidence: seen.entity === undefined ? 0 : 1 };
}

interface UiPlaces {
  readonly hp?: ObservedValue;
  readonly resources: Record<string, number>;
  readonly extra: Record<string, number>;
}

function readValue(reading: SeenUi, read: RenderTapConfig['ui'][number]['read']): number | undefined {
  if (read === 'fill') return reading.ui.role === 'bar' ? reading.ui.fill : undefined;
  return reading.ui.role === 'glyph' && /^-?d+(.d+)?$/.test(reading.ui.glyph) ? Number(reading.ui.glyph) : undefined;
}

function uiPlaces(ui: readonly SeenUi[], config: RenderTapConfig): UiPlaces {
  const places: { hp?: ObservedValue; resources: Record<string, number>; extra: Record<string, number> } = { resources: {}, extra: {} };
  for (const mapping of config.ui) {
    const reading = ui.find((seen) => seen.ui.element === mapping.element);
    const value = reading === undefined ? undefined : readValue(reading, mapping.read);
    if (value === undefined) continue;
    const [section, key, name] = mapping.path.split('.');
    if (mapping.path === 'self.hp') places.hp = { value: round(value), knowledge: 'shown' };
    else if (section === 'self' && key === 'resources' && name !== undefined) places.resources[name] = value;
    else if (section === 'extra' && key !== undefined && name === undefined) places.extra[key] = value;
  }
  return places;
}

export function tapToObservation(frame: TapFrame, context: TapContext): ObservationFrame {
  const selection = selectPlayerDraws(frame, context.signatures);
  const selfKey = context.config.self === undefined ? undefined : appearanceKey(context.config.self.mesh, context.config.self.material);
  const selfIndex = selfKey === undefined ? new Map<string, readonly string[]>() : new Map([[selfKey, ['self']]]);
  const avatar = selfKey === undefined ? undefined : selectPlayerDraws(frame, selfIndex).seen.find((seen) => seen.entity === 'self');
  const others = selection.seen.filter((seen) => avatar === undefined || seen.instance !== avatar.instance);
  const pos = avatar?.pos ?? cameraPosition(frame.camera.view);
  const { hp, resources, extra } = uiPlaces(selection.ui, context.config);
  const node = nearestNode(context.map, pos);
  return {
    tick: frame.tick ?? frame.frame,
    t: frame.t,
    source: 'render-tap',
    mode: 'player',
    purpose: context.purpose,
    self: { pos, ...(hp === undefined ? {} : { hp }), ...(Object.keys(resources).length === 0 ? {} : { resources }) },
    entities: others.map(entityOf),
    stage: { id: context.stageId, ...(node === undefined ? {} : { node }) },
    events: [],
    ...(Object.keys(extra).length === 0 ? {} : { extra }),
  };
}
// @ts-expect-error augur-inject
tapToObservation = contract(tapToObservation, { ...augurContract_32f2ba67, contractId: 'C-74', mode: 'observe', sample: 1, where: 'src/adapters/render-tap/tap-to-observation.ts:77', rule: 'contract-wrap', id: '32f2ba67' }); /* augur-inject:contract-wrap:32f2ba67 */
