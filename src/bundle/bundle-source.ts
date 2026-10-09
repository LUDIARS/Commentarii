// Port through which the loader reads a guide bundle. The file system adapter implements it
// today; the Web editor (stage 7) can implement it over its own storage.

export interface BundleSource {
  /** Every file in the bundle as a POSIX path relative to the bundle root, in any order. */
  listFiles(): Promise<string[]>;
  /** UTF-8 text of one file listed by listFiles(). */
  readText(relativePath: string): Promise<string>;
}
