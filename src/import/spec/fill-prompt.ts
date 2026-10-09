// Prompt template -> prompt. Placeholders are {{name}}; an unknown placeholder is a broken
// template and fails instead of reaching the model half-filled.

import { ImportError } from '../import-error.ts';

export function fillPrompt(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new ImportError(`prompt placeholder {{${name}}} has no value`);
    return value;
  });
}
