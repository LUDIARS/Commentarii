import type { LocalizedText } from './documents.ts';

const PREFERRED_LANGUAGES = ['ja', 'en'] as const;

/** Pick the display string of a localized text: ja, then en, then the first entry. */
export function localize(text: LocalizedText | undefined): string {
  if (text === undefined) return '';
  for (const language of PREFERRED_LANGUAGES) {
    const candidate = text[language];
    if (candidate !== undefined) return candidate;
  }
  return Object.values(text)[0] ?? '';
}
