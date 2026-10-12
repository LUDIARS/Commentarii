// SDK 0.5.0: the engine's planning and opponent outputs (Ingenium R3) as SDK formats. One test per
// format: the engine's own output validates, a broken variant does not. Then the read / write
// functions, the paths, and the loader keeping the outputs apart from the bundle.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  APPROVED_BUDGET_TABLE_FORMAT,
  APPROVED_BUDGET_TABLE_PATH,
  engineOutputSchemaOf,
  EngineOutputError,
  METHOD_BANDIT_FORMAT,
  METHOD_BANDIT_PATH,
  METHOD_REPORT_FORMAT,
  METHOD_REPORT_PATH,
  OPPONENT_MODEL_FORMAT,
  opponentModelPath,
  PLANNING_PROPOSALS_FORMAT,
  PLANNING_PROPOSALS_PATH,
  readEngineOutput,
  writeEngineOutput,
  type ApprovedBudgetTable,
  type MethodBandit,
  type MethodReport,
  type OpponentModel,
  type PlanningProposals,
} from '@ludiars/commentarii-sdk/types';
import { runValidation } from '../../src/validate/run-validation.ts';
import { ENGINE_OUTPUTS_DIR, loadSample, loadSampleWithOutputs, schemaRegistry } from '../support/bundles.ts';

async function fixture<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(join(ENGINE_OUTPUTS_DIR, path), 'utf8')) as T;
}

test('method-report/1: the engine report validates; a share above 1 and an unknown row do not', async () => {
  const registry = await schemaRegistry();
  const report = await fixture<MethodReport>(METHOD_REPORT_PATH);
  assert.equal(report.format, METHOD_REPORT_FORMAT);
  assert.deepEqual(registry.validate('method-report', report), []);
  const [row] = report.rows;
  assert.ok(row);
  assert.notDeepEqual(registry.validate('method-report', { ...report, rows: [{ ...row, share: 1.5 }] }), []);
  assert.notDeepEqual(registry.validate('method-report', { ...report, rows: [{ ...row, row: 'realtime/panic/high-trust' }] }), []);
  assert.notDeepEqual(registry.validate('method-report', { ...report, extra: 1 }), [], 'no fields beyond the engine output');
});

test('planning-proposals/1: the engine proposals validate; another planner and a malformed hash do not', async () => {
  const registry = await schemaRegistry();
  const proposals = await fixture<PlanningProposals>(PLANNING_PROPOSALS_PATH);
  assert.equal(proposals.format, PLANNING_PROPOSALS_FORMAT);
  assert.deepEqual(registry.validate('planning-proposals', proposals), []);
  const [first] = proposals.proposals;
  assert.ok(first);
  assert.notDeepEqual(registry.validate('planning-proposals', { ...proposals, proposals: [{ ...first, planner: 'reactive' }] }), []);
  assert.notDeepEqual(registry.validate('planning-proposals', { ...proposals, proposals_hash: 'abc' }), []);
});

test('approved-budget-table/1: an approved copy validates; one without approver or approval does not', async () => {
  const registry = await schemaRegistry();
  const approved = await fixture<ApprovedBudgetTable>(APPROVED_BUDGET_TABLE_PATH);
  assert.equal(approved.format, APPROVED_BUDGET_TABLE_FORMAT);
  assert.deepEqual(registry.validate('approved-budget-table', approved), []);
  assert.notDeepEqual(registry.validate('approved-budget-table', { ...approved, approval: { ...approved.approval, approved_by: ' ' } }), []);
  const { approval: _approval, ...unapproved } = approved;
  assert.notDeepEqual(registry.validate('approved-budget-table', unapproved), []);
  assert.notDeepEqual(registry.validate('approved-budget-table', { ...approved, proposals: { ...approved.proposals, format: 'method-report/1' } }), []);
});

test('opponent-model/1: a learned model validates; an unknown motion class or context, or a non-entity ID, does not', async () => {
  const registry = await schemaRegistry();
  const model = await fixture<OpponentModel>(opponentModelPath('enemy:bestia:wire-spider'));
  assert.equal(model.format, OPPONENT_MODEL_FORMAT);
  assert.deepEqual(registry.validate('opponent-model', model), []);
  assert.notDeepEqual(registry.validate('opponent-model', { ...model, counts: { 'near|own:moved': { fly: 1 } } }), []);
  assert.notDeepEqual(registry.validate('opponent-model', { ...model, counts: { close: { attack: 1 } } }), []);
  assert.notDeepEqual(registry.validate('opponent-model', { ...model, entity: 'e:2' }), []);
});

test('method-bandit/1: the statistics validate; a third arm and a fractional count do not', async () => {
  const registry = await schemaRegistry();
  const bandit = await fixture<MethodBandit>(METHOD_BANDIT_PATH);
  assert.equal(bandit.format, METHOD_BANDIT_FORMAT);
  assert.deepEqual(registry.validate('method-bandit', bandit), []);
  assert.notDeepEqual(registry.validate('method-bandit', { ...bandit, versions: { v: { s: { reactive: { n: 1, total: 0.5 } } } } }), []);
  assert.notDeepEqual(registry.validate('method-bandit', { ...bandit, versions: { v: { s: { mcts: { n: 1.5, total: 0.5 } } } } }), []);
});

test('read / write: schema-checked both ways, the same text the engine writes, refused whole otherwise', async () => {
  const registry = await schemaRegistry();
  const text = await readFile(join(ENGINE_OUTPUTS_DIR, PLANNING_PROPOSALS_PATH), 'utf8');
  const proposals = readEngineOutput('planning-proposals', text, registry);
  // The fixture's line ends depend on the checkout (core.autocrlf); the engine writes LF.
  assert.equal(writeEngineOutput('planning-proposals', proposals, registry), text.replace(/\r\n/g, '\n'));
  assert.deepEqual(readEngineOutput('planning-proposals', text.replace(/\n/g, '\r\n'), registry), proposals, 'CRLF text reads the same');
  assert.throws(() => readEngineOutput('planning-proposals', '{', registry), EngineOutputError);
  assert.throws(() => readEngineOutput('approved-budget-table', text, registry), (error: unknown) => error instanceof EngineOutputError && error.schema === 'approved-budget-table');
  assert.throws(() => writeEngineOutput('method-bandit', { format: METHOD_BANDIT_FORMAT, versions: { v: { s: { mcts: { n: -1, total: 0 } } } } }, registry), EngineOutputError);
});

test('paths: each output has one place under observations/; anything else is no engine output', () => {
  assert.equal(engineOutputSchemaOf('observations/planning/method-report.json'), 'method-report');
  assert.equal(engineOutputSchemaOf('observations/planning/proposals.json'), 'planning-proposals');
  assert.equal(engineOutputSchemaOf('observations/planning/approved-budget-table.json'), 'approved-budget-table');
  assert.equal(engineOutputSchemaOf('observations/selection/method-bandit.json'), 'method-bandit');
  assert.equal(engineOutputSchemaOf('observations/opponents/wire-spider.json'), 'opponent-model');
  assert.equal(opponentModelPath('enemy:bestia:wire-spider'), 'observations/opponents/wire-spider.json');
  for (const path of ['observations/overlay.json', 'observations/opponents/a/b.json', 'tactics/x.json', 'observations/planning/other.json']) assert.equal(engineOutputSchemaOf(path), undefined, path);
});

test('the loader keeps engine outputs apart: no bundle issue, no bundle file, and they pass V21-V26', async () => {
  const bare = await loadSample();
  const load = await loadSampleWithOutputs();
  assert.equal(bare.outputs, undefined);
  assert.deepEqual(load.issues, bare.issues);
  assert.equal(load.files.length, bare.files.length);
  assert.deepEqual(load.outputs?.map((output) => [output.path, output.schema, output.violations.length]), [
    ['observations/opponents/wire-spider.json', 'opponent-model', 0],
    ['observations/planning/approved-budget-table.json', 'approved-budget-table', 0],
    ['observations/planning/method-report.json', 'method-report', 0],
    ['observations/planning/proposals.json', 'planning-proposals', 0],
    ['observations/selection/method-bandit.json', 'method-bandit', 0],
  ]);
  const report = runValidation(load);
  assert.ok(report.ok);
  assert.deepEqual(report.checks.filter((check) => ['V21', 'V22', 'V23', 'V24', 'V25', 'V26'].includes(check.id)).map((check) => check.status), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
});
