// Which files of the game repository are scanned, and which of them count as UI text.

/** Never scanned: dependencies, build output and VCS metadata. */
export const EXCLUDED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist', '.git']);

/** UI strings and localization tables: the only files checked for undefined-exposure. */
const LOCALIZATION_EXTENSIONS: readonly string[] = ['.json', '.csv', '.po', '.resx', '.yaml', '.yml'];

function hasExtension(path: string, extensions: readonly string[]): boolean {
  const lower = path.toLowerCase();
  return extensions.some((extension) => lower.endsWith(extension.toLowerCase()));
}

export function isInExcludedDir(path: string): boolean {
  return path.split('/').slice(0, -1).some((segment) => EXCLUDED_DIRS.has(segment));
}

export function selectScanTargets(paths: readonly string[], extensions: readonly string[]): string[] {
  return paths.filter((path) => !isInExcludedDir(path) && hasExtension(path, extensions));
}

/** Text decoded from a binary file carries NUL characters; such files are skipped. */
export function looksBinary(text: string): boolean {
  return text.includes('\u0000');
}

export function isLocalizationFile(path: string): boolean {
  return hasExtension(path, LOCALIZATION_EXTENSIONS);
}

export function isJsonFile(path: string): boolean {
  return path.toLowerCase().endsWith('.json');
}
