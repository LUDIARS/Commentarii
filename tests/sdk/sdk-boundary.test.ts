// The SDK boundary (spec/plan/2026-10-11-ingenium-integrated-design.md §4): src/ reaches the SDK
// only through @ludiars/commentarii-sdk and its declared subpaths, never through
// packages/sdk/src/** paths; and the SDK itself depends on nothing but node:, ajv and its own files.

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { REPO_ROOT } from '../support/bundles.ts';

const SDK_NAME = '@ludiars/commentarii-sdk';
const SDK_ROOT = join(REPO_ROOT, 'packages', 'sdk');
const SDK_SOURCE = join(SDK_ROOT, 'src');
/** `from '…'`, `import '…'`, `import('…')` and `export … from '…'`. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;

async function typeScriptFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await typeScriptFiles(path)));
    else if (entry.name.endsWith('.ts')) files.push(path);
  }
  return files;
}

async function importsOf(file: string): Promise<string[]> {
  const text = await readFile(file, 'utf8');
  return [...text.matchAll(SPECIFIER)].map((match) => match[2] as string);
}

function isInside(path: string, directory: string): boolean {
  const rel = relative(directory, path);
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep) && !/^[a-zA-Z]:/.test(rel);
}

async function declaredSubpaths(): Promise<Set<string>> {
  const manifest = JSON.parse(await readFile(join(SDK_ROOT, 'package.json'), 'utf8')) as { exports: Record<string, unknown> };
  return new Set(Object.keys(manifest.exports).map((key) => (key === '.' ? SDK_NAME : `${SDK_NAME}/${key.slice(2)}`)));
}

test('src/ imports the SDK only through @ludiars/commentarii-sdk and its declared subpaths', async () => {
  const allowed = await declaredSubpaths();
  const violations: string[] = [];
  let sdkImports = 0;
  for (const file of await typeScriptFiles(join(REPO_ROOT, 'src'))) {
    for (const specifier of await importsOf(file)) {
      const where = `${relative(REPO_ROOT, file)}: ${specifier}`;
      if (specifier.startsWith('.')) {
        if (isInside(resolve(dirname(file), specifier), SDK_ROOT)) violations.push(where);
      } else if (specifier === SDK_NAME || specifier.startsWith(`${SDK_NAME}/`)) {
        sdkImports += 1;
        if (!allowed.has(specifier)) violations.push(where);
      } else if (/packages[\\/]sdk/.test(specifier)) {
        violations.push(where);
      }
    }
  }
  assert.deepEqual(violations, []);
  assert.ok(sdkImports > 0, 'src/ is expected to use the SDK');
});

test('every declared SDK subpath has its entry module', async () => {
  for (const subpath of await declaredSubpaths()) {
    const name = subpath === SDK_NAME ? 'index' : subpath.slice(SDK_NAME.length + 1);
    if (name === 'package.json') continue;
    await assert.doesNotReject(readFile(join(SDK_SOURCE, `${name}.ts`), 'utf8'), `${subpath} has no src/${name}.ts`);
  }
});

test('the SDK depends on nothing but node:, ajv, its own files and its contract runtime', async () => {
  const manifest = JSON.parse(await readFile(join(SDK_ROOT, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
  assert.deepEqual(Object.keys(manifest.dependencies ?? {}).sort(), ['ajv', 'ajv-formats']);
  const violations: string[] = [];
  for (const file of await typeScriptFiles(SDK_SOURCE)) {
    for (const specifier of await importsOf(file)) {
      const external = !specifier.startsWith('.') && !specifier.startsWith('node:') && specifier !== '#contract-runtime';
      const escapes = specifier.startsWith('.') && !isInside(resolve(dirname(file), specifier), SDK_SOURCE);
      const allowedExternal = specifier === 'ajv-formats' || specifier === 'ajv' || specifier.startsWith('ajv/');
      if ((external && !allowedExternal) || escapes) violations.push(`${relative(REPO_ROOT, file)}: ${specifier}`);
    }
  }
  assert.deepEqual(violations, []);
});
