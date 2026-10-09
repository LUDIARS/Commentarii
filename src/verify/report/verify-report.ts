// The intent verification report (spec/feature/intent-verify.md 5): what `guide verify intent
// --json` prints and observations/verify/report.json holds. guide render reads it back to put
// the heatmaps and bands on the stage pages.

import type { Band, PlayAxes } from '../feasibility/feasibility-document.ts';
import type { HeatPanel } from '../heatmap/aggregate-heatmap.ts';
import type { IntentVerdict } from '../intent/classify-intents.ts';
import type { Divergence } from '../intent/divergence.ts';
import type { DivergenceDecision } from '../intent/divergence-store.ts';
import type { PromotionCandidate } from '../intent/promotion-candidates.ts';
import type { UnusedMechanisms } from '../intent/unused-mechanisms.ts';

export const VERIFY_DIRECTORY = 'observations/verify';
export const REPORT_JSON_PATH = `${VERIFY_DIRECTORY}/report.json`;
export const REPORT_MARKDOWN_PATH = `${VERIFY_DIRECTORY}/report.md`;
export const GOOD_PLAY_SVG = 'good-play.svg';

export function heatmapFileName(stageSlug: string): string {
  return `${stageSlug}.heatmap.svg`;
}

export interface SideReach {
  readonly runs: number;
  readonly reached: number;
  /** null without runs. */
  readonly reach_rate: number | null;
}

export interface ReportedDivergence extends Divergence {
  readonly decision: DivergenceDecision;
}

export interface AcceptedSummary {
  readonly id: string;
  readonly intent: string;
  readonly reason: string;
  readonly run: string;
  readonly decided_by: string;
}

export interface StageReport {
  readonly stage: string;
  readonly slug: string;
  readonly design_stance: string;
  readonly reach: { readonly autoplay: SideReach; readonly human: SideReach };
  readonly intents: readonly IntentVerdict[];
  readonly divergences: readonly ReportedDivergence[];
  readonly accepted: readonly AcceptedSummary[];
  readonly promotions: readonly PromotionCandidate[];
  readonly tactics_used: readonly { readonly tactic: string; readonly runs: number }[];
  readonly time: { readonly median_sec?: number; readonly range_sec?: readonly [number, number]; readonly diff_sec?: number };
  readonly unused: UnusedMechanisms;
  readonly heatmap: {
    readonly svg: string;
    readonly panels: readonly HeatPanel[];
    readonly routes: readonly (readonly string[])[];
    readonly forbid: readonly string[];
  };
  readonly feasibility: {
    readonly path: string;
    readonly bands: Readonly<Record<Band, number>>;
    readonly illusory: readonly string[];
    readonly axes: readonly PlayAxes[];
  };
}

export interface VerifyReport {
  readonly game_id: string;
  readonly persona?: string;
  readonly runs: {
    readonly counted: readonly string[];
    readonly ignored_omniscient: readonly string[];
    readonly ignored_efficiency: readonly string[];
    readonly filtered_out: readonly string[];
    readonly unreadable: readonly string[];
  };
  readonly good_play_svg: string;
  readonly stages: readonly StageReport[];
}
