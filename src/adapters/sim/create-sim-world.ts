// Bundle -> the initial SimWorld of one stage: enemies from the stage's spawns (stats from the
// entity documents, behavior from their state machine), self at the first spawn node (stats
// from the first actor entity if the bundle has one, else the sim's defaults).

import type { Bundle, StageFiles } from '../../bundle/bundle.ts';
import type { Entity, MaskedEntity, Rule, Stage, StateMachine } from '../../domain/documents.ts';
import { parseRef } from '../../domain/id.ts';
import { createRng } from '../../engine/rng.ts';
import type { FighterStats, SimConfig } from './sim-config.ts';
import { createSimLayout, type Point } from './sim-layout.ts';
import { statsOf } from './sim-rules.ts';
import type { SimEnemy, SimWorld } from './sim-world.ts';

export class SimSetupError extends Error {
  override readonly name = 'SimSetupError';
}

function fighterStats(stats: Readonly<Record<string, number>>, fallback: FighterStats): FighterStats {
  return {
    health: stats.health ?? stats.hp ?? fallback.health,
    speed: stats.speed ?? fallback.speed,
    range: stats.range ?? fallback.range,
    cooldown: stats.cooldown ?? fallback.cooldown,
    power: stats.power ?? fallback.power,
  };
}

function pickStage(bundle: Bundle, stageId: string | undefined): StageFiles & { readonly stage: { readonly doc: Stage } } {
  const stages = bundle.stages.filter((stage): stage is StageFiles & { stage: { path: string; doc: Stage } } => stage.stage !== undefined);
  const stage = stageId === undefined ? stages[0] : stages.find((candidate) => candidate.stage.doc.id === stageId);
  if (stage === undefined) throw new SimSetupError(stageId === undefined ? 'the bundle has no stage to simulate' : `stage ${stageId} is not in the bundle`);
  return stage;
}

function timeLimitOf(bundle: Bundle, stage: Stage): number | undefined {
  const limit = stage.time_limit?.value;
  if (typeof limit === 'number' && limit > 0) return limit;
  for (const { doc } of bundle.intents) {
    if (doc.stage !== stage.id) continue;
    for (const item of doc.intended) if (item.kind === 'time') return item.range_sec[1];
  }
  return undefined;
}

function damageRuleOf(rules: ReadonlyMap<string, Rule>, gameId: string | undefined): Rule | undefined {
  for (const [id, rule] of rules) {
    const parsed = parseRef(id);
    if (parsed?.slug === 'damage' && (gameId === undefined || parsed.game === gameId)) return rule;
  }
  return undefined;
}

export interface SimSetup {
  readonly bundle: Bundle;
  readonly seed: number;
  readonly config: SimConfig;
  /** Stage to play; the first stage of the bundle when absent. */
  readonly stageId?: string;
}

export function createSimWorld(setup: SimSetup): SimWorld {
  const { bundle, config } = setup;
  const files = pickStage(bundle, setup.stageId);
  const stage = files.stage.doc;
  const layout = createSimLayout(files.map?.doc, config.nodeSpacing, config.gridCell);
  const entities = new Map<string, Entity>(bundle.entities.map(({ doc }) => [doc.id, doc]));
  const masked = new Map<string, MaskedEntity>(bundle.maskedEntities.map(({ doc }) => [doc.id, doc]));
  const machines = new Map<string, StateMachine>(bundle.states.map(({ doc }) => [doc.id, doc]));
  const rules = new Map<string, Rule>(bundle.rules.map(({ doc }) => [doc.id, doc]));

  const spawnNode = stage.spawns?.[0]?.at;
  const roster: { entity: Entity; at: string | undefined }[] = [];
  for (const spawn of stage.spawns ?? []) {
    const entity = entities.get(spawn.entity);
    if (entity === undefined) throw new SimSetupError(`spawn ${spawn.entity} has no entity document`);
    for (let i = 0; i < spawn.count.value; i += 1) roster.push({ entity, at: spawn.at });
  }
  // Self takes the first slot of the first spawn node; the roster shares the remaining slots.
  const slots = roster.length + 1;
  const point = (at: string | undefined, k: number): Point => layout.spawnPoint(at, k, slots);

  const actor = bundle.entities.find(({ doc }) => parseRef(doc.id)?.kind === 'actor')?.doc;
  const selfStats = fighterStats(statsOf(actor), config.self);
  const enemies: SimEnemy[] = roster.map(({ entity, at }, index) => {
    const stats = fighterStats(statsOf(entity, masked.get(entity.id)), config.enemy);
    const machine = entity.behavior === undefined ? undefined : machines.get(entity.behavior);
    return {
      instance: index + 1,
      entity,
      ...(masked.has(entity.id) ? { masked: masked.get(entity.id) as MaskedEntity } : {}),
      ...(machine === undefined ? {} : { machine, state: machine.initial }),
      pos: point(at, index + 1),
      hp: stats.health,
      maxHp: stats.health,
      speed: stats.speed,
      range: stats.range,
      cooldown: stats.cooldown,
      power: stats.power,
      readyAt: 0,
      stateSince: 0,
      dodgeUntil: 0,
      shotAt: false,
      alive: true,
    };
  });
  const timeLimit = timeLimitOf(bundle, stage);
  const damageRule = damageRuleOf(rules, bundle.manifest?.doc.game_id);
  return {
    tick: 0,
    t: 0,
    stageId: stage.id,
    ...(timeLimit === undefined ? {} : { timeLimit }),
    self: {
      pos: point(spawnNode, 0),
      hp: selfStats.health,
      maxHp: selfStats.health,
      speed: selfStats.speed,
      range: selfStats.range,
      cooldown: selfStats.cooldown,
      power: selfStats.power,
      readyAt: 0,
      lastDamagedT: 0,
      moved: false,
    },
    enemies,
    layout,
    hazardNodes: new Set((files.map?.doc.annotations ?? []).filter((note) => note.kind === 'hazard').map((note) => note.target)),
    rules,
    ...(damageRule === undefined ? {} : { damageRule }),
    config,
    rng: createRng(setup.seed),
    events: [],
    damageTaken: 0,
    damageDealt: 0,
    outcome: enemies.length === 0 ? 'success' : 'running',
  };
}
