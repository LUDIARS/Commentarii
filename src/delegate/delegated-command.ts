// The auto player commands that moved to Ingenium (Ingenium R0-B). For one version `guide` still
// accepts them and hands the arguments over to `ingenium` unchanged (src/delegate/run-delegation.ts);
// the next minor version drops them (COMPAT.md).

/** argv of a moved command: run, bench (compare / replay), gate, replay, report signatures. */
export function isDelegatedCommand(argv: readonly string[]): boolean {
  const [name, sub] = argv;
  if (name === 'run' || name === 'bench' || name === 'gate' || name === 'replay') return true;
  return name === 'report' && sub === 'signatures';
}

export const DELEGATED_USAGE = `  guide run | bench | bench compare | bench replay | gate balance | replay play|diff | report signatures ...
      moved to Ingenium: the arguments are handed to \`ingenium\` on PATH (exit 2 when it is not installed)
`;

export const MOVED_MESSAGE = (command: string): string =>
  `guide ${command}: the auto player moved to Ingenium (Ingenium に移りました). Install Ingenium and put \`ingenium\` on PATH, then run \`ingenium ${command} ...\` with the same arguments.\n`;
