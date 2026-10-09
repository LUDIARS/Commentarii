// Port through which the audit reads the game repository. The file system adapter
// (fs-scan-source.ts) implements it; tests pass in-memory sources.

export interface ScanSource {
  /**
   * Every regular file under the given roots (a root may itself be a file), as POSIX paths
   * that start with the root as given. Excluded directories (scan-targets.ts) are not entered.
   */
  listFiles(roots: readonly string[]): Promise<string[]>;
  /** UTF-8 text of one listed file. */
  readText(path: string): Promise<string>;
}

/** A scanned file's path and text. */
export interface ScanText {
  readonly path: string;
  readonly text: string;
}

export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}
