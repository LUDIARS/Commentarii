// ActionStep -> concrete adapter action: `$binding` operands become entity instance numbers.
// Undefined when a binding is missing or its instance is no longer visible (the leaf fails).

import { isBindingName, type Bindings } from '../match/bindings.ts';
import { findInstance } from '../observation/visible-entities.ts';
import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { ACTION_VERBS, type ActionOperand, type ActionVerb, type ReplayAction } from '../../replay/replay-action.ts';
import type { ActionStep } from './bt-node.ts';

export function stepVerb(step: ActionStep): ActionVerb | undefined {
  return ACTION_VERBS.find((verb) => step[verb] !== undefined);
}

function resolveOperand(operand: ActionOperand, bindings: Bindings, observation: ObservationFrame): ActionOperand | undefined {
  if (!isBindingName(operand)) return operand;
  const instance = bindings[operand];
  if (instance === undefined || findInstance(observation, instance) === undefined) return undefined;
  return instance;
}

export function resolveStep(step: ActionStep, bindings: Bindings, observation: ObservationFrame): ReplayAction | undefined {
  const verb = stepVerb(step);
  const operand = verb === undefined ? undefined : step[verb];
  if (verb === undefined || operand === undefined) return undefined;
  const resolved = resolveOperand(operand, bindings, observation);
  if (resolved === undefined) return undefined;
  const target = step.target === undefined ? undefined : resolveOperand(step.target, bindings, observation);
  if (step.target !== undefined && target === undefined) return undefined;
  return {
    [verb]: resolved,
    ...(target === undefined ? {} : { target }),
    ...(step.params === undefined ? {} : { params: step.params }),
  };
}
