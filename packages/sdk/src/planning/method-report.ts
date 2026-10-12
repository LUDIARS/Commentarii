// The offline method evaluation (schema/method-report.schema.json, Ingenium R3, SDK 0.5.0): bench
// episodes aggregated by situation (the budget row) and proposer. Measurement only: how often a
// proposer's plans ran, how far its prediction was from what then happened, how often it
// delivered, the clear rate of the runs it played in and the wall clock of the decisions that
// picked it (recorded, never used to decide). It is the evidence a budget table proposal cites;
// it never changes a table. Counts and numbers only (no game values).

export const METHOD_REPORT_FORMAT = 'method-report/1';

export interface MethodReportRow {
  /** <form>/<regime>/<band>-trust of the budget table. */
  readonly row: string;
  readonly proposer: string;
  readonly episodes: number;
  readonly ticks: number;
  /** Share of the row's ticks this proposer's plans ran. */
  readonly share: number;
  readonly predicted_mean: number;
  readonly realized_mean: number;
  readonly abs_error: number;
  readonly success_rate: number;
  readonly clear_rate: number;
  readonly wall_p50_ms?: number;
  readonly wall_p95_ms?: number;
}

export interface MethodReport {
  readonly format: typeof METHOD_REPORT_FORMAT;
  readonly episodes: number;
  readonly rows: readonly MethodReportRow[];
  /** Share of all ticks by proposer. */
  readonly proposer_share: Readonly<Record<string, number>>;
  /** Share of replanning episodes by selector rule. */
  readonly rule_share: Readonly<Record<string, number>>;
}
