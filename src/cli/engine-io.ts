// What `guide run` / `guide bench` / `guide replay play --decider utility-bt` need from the
// outside world beyond CliIo. main.ts wires the real adapters; tests pass in-memory ones.

import type { LineChannel } from '../adapters/stdio/line-channel.ts';
import type { Persona } from '../engine/persona/persona.ts';
import type { ReplayLineWriter } from '../replay/recording-sink.ts';

export interface EngineIo {
  /** The persona with this slug: the bundle's own first, then the shipped one. */
  loadPersona(bundleDir: string, slug: string): Promise<Persona>;
  /** A new replay file (refuses an existing one). */
  createReplayWriter(path: string): Promise<ReplayLineWriter>;
  /** The engine process's own stdin / stdout as the adapter protocol channel. */
  openStdioChannel(): LineChannel;
  now(): Date;
  /** The engine's version (package.json), recorded in bench results; absent = unknown. */
  engineVersion?(): Promise<string>;
}
