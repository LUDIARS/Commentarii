// One file an import would create, rewrite or remove inside the bundle.

export interface FileChange {
  /** POSIX path relative to the bundle root. */
  readonly path: string;
  /** Current document; undefined when the file does not exist yet. */
  readonly before: unknown;
  /** Document to write; undefined when the import removes the file. */
  readonly after: unknown;
}
