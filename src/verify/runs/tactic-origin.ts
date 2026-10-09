// The tactic a chosen tactic ID stands for: an exploration variant (<tactic>--<mutation>,
// stage 4) stands for the tactic it was derived from.

export function tacticOrigin(tactic: string): string {
  const cut = tactic.indexOf('--');
  return cut < 0 ? tactic : tactic.slice(0, cut);
}
