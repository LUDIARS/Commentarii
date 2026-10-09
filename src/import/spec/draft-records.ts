// Shared steps of turning the model's reply into draft records: read the array under one key,
// take each record's slug, and overwrite every field the model must not decide (principle 3:
// the LLM drafts text; knowledge, source and draft are fixed here).

import type { Source } from '../../domain/documents.ts';
import { isJsonObject, type JsonObject } from '../../domain/value-node.ts';
import type { SchemaViolation } from '../../schema/schema-registry.ts';
import type { DraftRequest } from './draft-request.ts';

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

/** Fields the reply may carry but never decides. */
const FIXED_FIELDS = ['slug', 'id', 'knowledge', 'source', 'draft'];

export interface ReplyRecord {
  readonly slug: string;
  /** The record without its fixed fields. */
  readonly fields: JsonObject;
  /** JSON pointer of the record inside the reply. */
  readonly pointer: string;
}

export interface ReplyRecords {
  readonly records: ReplyRecord[];
  readonly problems: string[];
}

export function draftSource(request: DraftRequest): Source {
  return { kind: 'llm-draft', ref: request.sourceName };
}

export function readReplyRecords(reply: unknown, key: string): ReplyRecords {
  const records: ReplyRecord[] = [];
  const problems: string[] = [];
  const list = isJsonObject(reply) ? reply[key] : undefined;
  if (!Array.isArray(list) || list.length === 0) return { records, problems: [`the reply must be {"${key}": [ ... ]} with at least one item`] };
  const seen = new Set<string>();
  list.forEach((item: unknown, position) => {
    const pointer = `/${key}/${position}`;
    if (!isJsonObject(item)) {
      problems.push(`${pointer}: not an object`);
      return;
    }
    const slug = item.slug;
    if (typeof slug !== 'string' || !SLUG.test(slug)) {
      problems.push(`${pointer}/slug: must be a slug ([a-z0-9][a-z0-9_-]*)`);
      return;
    }
    if (seen.has(slug)) problems.push(`${pointer}/slug: '${slug}' is used twice`);
    seen.add(slug);
    const fields = Object.fromEntries(Object.entries(item).filter(([field]) => !FIXED_FIELDS.includes(field)));
    records.push({ slug, fields, pointer });
  });
  return { records, problems };
}

export function describeViolations(pointer: string, violations: readonly SchemaViolation[]): string[] {
  return violations.map((violation) => `${pointer}${violation.pointer}: ${violation.message}`);
}
