// ID slug of a master row: the cell as is, or slugified free text when the mapping asks for it.

import { ImportError } from '../import-error.ts';

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

/** "Bazooka Beetle" -> "bazooka-beetle". Characters outside [a-z0-9_-] become separators. */
export function slugify(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|-+$/g, '');
}

export function slugOf(cell: string, shouldSlugify: boolean, ref: string): string {
  const slug = shouldSlugify ? slugify(cell) : cell;
  if (!SLUG.test(slug)) {
    throw new ImportError(`${ref}: '${cell}' is not an ID slug ([a-z0-9][a-z0-9_-]*)${shouldSlugify ? '' : '; set id.slugify in the mapping'}`);
  }
  return slug;
}
