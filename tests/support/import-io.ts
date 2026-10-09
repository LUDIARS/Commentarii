// Test helpers for the import commands: the real ImportIo with a scripted LLM, temp copies of
// the sample bundle, and the sample master inputs.

import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeBundleFiles } from '../../src/adapters/fs/remove-bundle-files.ts';
import { readPromptTemplate } from '../../src/adapters/llm/read-prompt-template.ts';
import { readSqliteTables } from '../../src/adapters/sqlite/read-sqlite-tables.ts';
import type { ImportIo } from '../../src/cli/import-io.ts';
import type { DraftLlm } from '../../src/import/spec/draft-llm.ts';
import { SAMPLE_DIR, schemaRegistry } from './bundles.ts';

export const MASTERS_DIR = join(SAMPLE_DIR, 'masters');
export const SAMPLE_CSV = join(MASTERS_DIR, 'archetypes.csv');
export const SAMPLE_MAPPING = join(MASTERS_DIR, 'mapping.json');
export const SAMPLE_GRID = join(MASTERS_DIR, 'ring.grid.txt');

export interface ScriptedLlm extends DraftLlm {
  readonly prompts: string[];
}

/** Answers with the given replies in order; a further call fails the test. */
export function scriptedLlm(...replies: string[]): ScriptedLlm {
  const prompts: string[] = [];
  return {
    prompts,
    async complete(prompt) {
      prompts.push(prompt);
      const reply = replies[prompts.length - 1];
      if (reply === undefined) throw new Error(`unexpected LLM call #${prompts.length}`);
      return reply;
    },
  };
}

export function testImportIo(llm: DraftLlm = scriptedLlm()): ImportIo {
  return {
    readText: (path) => readFile(path, 'utf8'),
    readSqliteTables: async (path, tables) => readSqliteTables(path, tables),
    removeFiles: removeBundleFiles,
    schemaRegistry,
    readPrompt: readPromptTemplate,
    llm,
  };
}

export async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'commentarii-test-'));
}

/** A disposable copy of samples/bestia. */
export async function copySample(): Promise<string> {
  const directory = await makeTempDir();
  await cp(SAMPLE_DIR, directory, { recursive: true });
  return directory;
}

export async function removeTempDir(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}
