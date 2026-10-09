// The fixed list of validate checks, in report order (design 6).

import type { Check } from '../check.ts';
import { v01Schema } from './v01-schema.ts';
import { v02References } from './v02-references.ts';
import { v03MaskedOutside } from './v03-masked-outside.ts';
import { v04MaskedOnly } from './v04-masked-only.ts';
import { v05KnowledgePresent } from './v05-knowledge-present.ts';
import { v06SourcePresent } from './v06-source-present.ts';
import { v07LlmDraft } from './v07-llm-draft.ts';
import { v08RuleExpressions } from './v08-rule-expressions.ts';
import { v09Units } from './v09-units.ts';
import { v10TacticKnowledge } from './v10-tactic-knowledge.ts';
import { v11Coverage } from './v11-coverage.ts';
import { v12IntentRefs } from './v12-intent-refs.ts';

export const CHECKS: readonly Check[] = [
  v01Schema,
  v02References,
  v03MaskedOutside,
  v04MaskedOnly,
  v05KnowledgePresent,
  v06SourcePresent,
  v07LlmDraft,
  v08RuleExpressions,
  v09Units,
  v10TacticKnowledge,
  v11Coverage,
  v12IntentRefs,
];
