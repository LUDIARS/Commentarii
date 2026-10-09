// Where a run is recorded: replay/<run-id>.jsonl, with the `run:` prefix dropped because
// ':' is not allowed in Windows file names.

const RUN_ID = /^run:([a-z0-9][a-z0-9_-]*)$/;

export const REPLAY_DIRECTORY = 'replay';

/** `run:bestia-dome-001` -> `replay/bestia-dome-001.jsonl` (always '/' separated). */
export function replayRelativePath(runId: string): string {
  const match = RUN_ID.exec(runId);
  if (!match) throw new Error(`not a run id: ${runId}`);
  return `${REPLAY_DIRECTORY}/${match[1]}.jsonl`;
}
