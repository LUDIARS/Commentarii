// LLM reply -> the JSON object it contains. Models sometimes wrap the object in a Markdown
// fence or a sentence, so the outermost {...} is taken.

export type ExtractedJson = { readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly message: string };

export function extractJson(text: string): ExtractedJson {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) return { ok: false, message: 'the reply contains no JSON object' };
  try {
    return { ok: true, data: JSON.parse(text.slice(start, end + 1)) };
  } catch (cause) {
    return { ok: false, message: `the reply is not valid JSON: ${(cause as Error).message}` };
  }
}
