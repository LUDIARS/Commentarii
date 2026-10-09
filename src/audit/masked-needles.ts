// What to look for: every masked value of the bundle's `.masked.json` companions, flattened to
// numbers, exact strings and ID slugs, each with the ref of the guide value it came from.

import type { Bundle } from '../bundle/bundle.ts';
import { parseRef } from '../domain/id.ts';
import { significantDigitsOfNumber } from './numeric-literal.ts';

export type MaskedNeedle =
  | { readonly kind: 'number'; readonly ref: string; readonly value: number; readonly unit?: string; readonly digits: number }
  /** A plain string value: matched as a whole token, case-sensitive. */
  | { readonly kind: 'text'; readonly ref: string; readonly text: string }
  /** An ID value (`<kind>:<game-id>:<slug>`): its slug is what leaks into game code. */
  | { readonly kind: 'id-slug'; readonly ref: string; readonly text: string };

function slugOfId(text: string): string | undefined {
  const parsed = parseRef(text);
  if (parsed === undefined || parsed.fragment !== undefined || parsed.path.length > 0) return undefined;
  return parsed.slug.split(':').at(-1);
}

function collect(value: unknown, ref: string, unit: string | undefined, out: MaskedNeedle[]): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    out.push({ kind: 'number', ref, value: Math.abs(value), ...(unit === undefined ? {} : { unit }), digits: significantDigitsOfNumber(value) });
  } else if (typeof value === 'string' && value.trim() !== '') {
    const slug = slugOfId(value);
    out.push(slug === undefined ? { kind: 'text', ref, text: value } : { kind: 'id-slug', ref, text: slug });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collect(item, `${ref}.${index}`, unit, out));
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) collect(item, `${ref}.${key}`, unit, out);
  }
}

export function collectMaskedNeedles(bundle: Bundle): MaskedNeedle[] {
  const needles: MaskedNeedle[] = [];
  for (const { doc } of bundle.maskedEntities) {
    for (const [name, stat] of Object.entries(doc.stats ?? {})) collect(stat.value, `${doc.id}.stats.${name}`, stat.unit, needles);
    for (const [name, field] of Object.entries(doc.fields ?? {})) collect(field.value, `${doc.id}.fields.${name}`, field.unit, needles);
  }
  return needles;
}
