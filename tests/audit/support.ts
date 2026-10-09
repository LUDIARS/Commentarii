// Test helpers for the mask audit: the audit guide overlay, the fake game repository and
// in-memory scan sources.

import { join } from 'node:path';
import { createFsBundleSource } from '../../src/adapters/fs/fs-bundle-source.ts';
import { resolveAuditConfig, type AuditConfig } from '../../src/audit/audit-config.ts';
import { fsScanSource } from '../../src/audit/fs-scan-source.ts';
import type { ScanSource, ScanText } from '../../src/audit/scan-source.ts';
import { looksBinary, selectScanTargets } from '../../src/audit/scan-targets.ts';
import type { LoadResult } from '../../src/bundle/bundle.ts';
import type { BundleSource } from '../../src/bundle/bundle-source.ts';
import { loadBundle } from '../../src/bundle/load-bundle.ts';
import { overlaySource, REPO_ROOT, SAMPLE_DIR, schemaRegistry } from '../support/bundles.ts';

export const AUDIT_DIR = join(REPO_ROOT, 'tests', 'fixtures', 'audit');
export const AUDIT_GUIDE_DIR = join(AUDIT_DIR, 'guide');
export const AUDIT_GAME_DIR = join(AUDIT_DIR, 'game');

/** A bundle source holding the given files (relative path -> text). */
export function memorySource(files: Readonly<Record<string, string>>): BundleSource {
  return {
    async listFiles() {
      return Object.keys(files).sort();
    },
    async readText(path) {
      const text = files[path];
      if (text === undefined) throw new Error(`no such file: ${path}`);
      return text;
    },
  };
}

/** samples/bestia + the audit guide overlay (+ optional in-memory files on top). */
export async function loadAuditGuide(extra: Readonly<Record<string, string>> = {}): Promise<LoadResult> {
  const fixture = overlaySource(await createFsBundleSource(SAMPLE_DIR), await createFsBundleSource(AUDIT_GUIDE_DIR));
  return loadBundle(overlaySource(fixture, memorySource(extra)), await schemaRegistry());
}

export async function auditGuideConfig(): Promise<AuditConfig> {
  return resolveAuditConfig((await loadAuditGuide()).bundle.manifest?.doc);
}

/** Reads the fake game repository the way `guide audit mask` does. */
export async function readGameFiles(config: AuditConfig, source: ScanSource = fsScanSource, roots: readonly string[] = [AUDIT_GAME_DIR]): Promise<ScanText[]> {
  const files: ScanText[] = [];
  for (const path of selectScanTargets(await source.listFiles(roots), config.extensions)) {
    const text = await source.readText(path);
    if (!looksBinary(text)) files.push({ path, text });
  }
  return files;
}

/** A scan source over in-memory files (path -> text); roots select by path prefix. */
export function memoryScanSource(files: Readonly<Record<string, string>>): ScanSource {
  return {
    async listFiles(roots) {
      return Object.keys(files).filter((path) => roots.some((root) => path === root || path.startsWith(`${root}/`)));
    },
    async readText(path) {
      const text = files[path];
      if (text === undefined) throw new Error(`no such file: ${path}`);
      return text;
    },
  };
}
