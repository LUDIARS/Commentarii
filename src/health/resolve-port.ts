// Port of the dev server: COMMENTARII_PORT, default 4410 (Excubitor catalog). Invalid values
// fail fast instead of silently falling back to the default.

export const DEFAULT_PORT = 4410;

export function resolvePort(configured: string | undefined): number {
  if (configured === undefined || configured.trim() === '') return DEFAULT_PORT;
  const text = configured.trim();
  const port = Number(text);
  if (!/^\d+$/.test(text) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`COMMENTARII_PORT must be an integer between 1 and 65535 (got '${configured}')`);
  }
  return port;
}
