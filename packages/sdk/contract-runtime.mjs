// Augur `contract-wrap` observation runtime (repository-local shim).
//
// augur.contracts.json#importFrom is `#contract-runtime`, mapped here by package.json
// "imports", so every injection site resolves to this file whatever its depth, from dist/
// and from the test build alike. A local shim keeps @ludiars/log-weaver out of the
// dependencies (stage 1 allows ajv and ajv-formats only).
//
// The wrapper observes only: it never changes the wrapped function's result, exception or
// sync/async shape. Records go to Vestigium-compatible JSONL ({time, msg, ctx}) that
// `augur contracts report` reads. Recording happens only when VESTIGIUM_LOGS_DIR is set:
// the `guide` CLI runs inside game repositories and must not create logs/ there. The test
// runner (scripts/run-tests.mjs) sets it to <repo>/logs.
//
// ctx carries the contract id, position and the predicate's reason string only — never
// arguments or results (bundles may hold masked values).

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function logsDirectory() {
  const configured = process.env.VESTIGIUM_LOGS_DIR?.trim();
  return configured ? configured : undefined;
}

function record(message, context) {
  const directory = logsDirectory();
  if (directory === undefined) return;
  try {
    mkdirSync(directory, { recursive: true });
    appendFileSync(
      join(directory, 'contracts.jsonl'),
      `${JSON.stringify({ time: new Date().toISOString(), msg: message, ctx: context })}\n`,
      'utf8',
    );
  } catch {
    // Observation must never change the behavior of the wrapped function.
  }
}

function reasonOf(verdict) {
  if (verdict === true || verdict === undefined || verdict === null) return null;
  if (verdict === false) return 'predicate failed';
  return typeof verdict === 'string' ? verdict : null;
}

function isThenable(value) {
  return typeof value?.then === 'function';
}

export function contract(fn, spec) {
  const context = { contract: spec.contractId, id: spec.id, where: spec.where, rule: spec.rule };
  const evaluate = (phase, verdict) => {
    try {
      return reasonOf(verdict());
    } catch {
      record('contract predicate threw', { ...context, phase: 'predicate', reason: `${phase} predicate threw` });
      return null;
    }
  };

  return function contracted(...args) {
    const preReason = evaluate('pre', () => spec.pre?.(...args));
    if (preReason) record('contract violated', { ...context, phase: 'pre', reason: preReason });
    const settle = (result) => {
      const postReason = evaluate('post', () => spec.post?.(result, ...args));
      if (postReason) record('contract violated', { ...context, phase: 'post', reason: postReason });
      else if (!preReason) record('contract observed', { ...context, phase: 'ok' });
    };
    const rejected = (error) => {
      const throwReason = evaluate('postThrow', () => spec.postThrow?.(error, ...args));
      if (throwReason) record('contract violated', { ...context, phase: 'postThrow', reason: throwReason });
      else if (!preReason && spec.postThrow) record('contract observed', { ...context, phase: 'ok' });
    };

    let result;
    try {
      result = fn.apply(this, args);
    } catch (error) {
      rejected(error);
      throw error;
    }
    if (!isThenable(result)) {
      settle(result);
      return result;
    }
    return Promise.resolve(result).then(
      (value) => {
        settle(value);
        return value;
      },
      (error) => {
        rejected(error);
        throw error;
      },
    );
  };
}
