// Learned figures are rounded to 3 decimals so the overlay stays stable and readable.

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
