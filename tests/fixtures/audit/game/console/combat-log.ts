// Combat log lines written to the player-visible console.
export function logBeetleShot(log: (line: string) => void): void {
  log('beetle shot lead = speed / 32');
}

export function logSpiderAmbush(log: (line: string) => void): void {
  log('ambush script wire_ambush_b started, web tension 420 N');
}
