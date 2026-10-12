// One line of observations/plans/<run-slug>.jsonl (schema/plan-record.schema.json, Ingenium R2):
// a plan an engine carried out to the end, with the conjunction that held when it started and
// what it measured. The input of the learned-tactic rewrite path (design 8.2): an output of the
// decision, never an input of the autonomous stance.

export const PLAN_RECORD_FORMAT = 'plan-record/1';

/** Bundle-relative directory of the plan record files. */
export const PLAN_RECORDS_DIR = 'observations/plans';

export type PlanParamKind = 'entity' | 'node' | 'point' | 'number';

export interface PlanRecordStep {
  readonly action: string;
  /** Parameter name -> kind of the bound value (never instance numbers). */
  readonly params: Readonly<Record<string, PlanParamKind>>;
  readonly repeat_until?: string;
}

export interface PlanRecord {
  readonly format: typeof PLAN_RECORD_FORMAT;
  readonly run: string;
  readonly game_id: string;
  /** Tick the plan started on. */
  readonly tick: number;
  readonly stance: 'autonomous' | 'hybrid';
  readonly proposer: string;
  readonly goal: string;
  /** The conjunction that held when the plan started (expr/2). */
  readonly when_expr: string;
  readonly steps: readonly PlanRecordStep[];
  readonly because: { readonly actions: readonly string[]; readonly rules: readonly string[] };
  readonly predicted: { readonly progress: number; readonly time_sec?: number };
  readonly measured: { readonly progress: number; readonly time_sec: number; readonly damage: number };
  readonly outcome: 'success' | 'failure';
  readonly confidence: 'learned';
}
