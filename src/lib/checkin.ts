// Daily check-in analytics — pure helpers correlating self-reported energy/mood
// with habit completion. No DB access. The "hidden variable" layer: surfaces
// whether your habits track with how you actually feel.

export type CheckinLite = { date: string; energy: number; mood: number };

// Pearson correlation coefficient of two equal-length series, or null when it's
// undefined (fewer than 2 points, or a series with zero variance).
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const cov = n * sxy - sx * sy;
  const dx = n * sxx - sx * sx;
  const dy = n * syy - sy * sy;
  if (dx <= 0 || dy <= 0) return null; // no variance in one series
  return cov / Math.sqrt(dx * dy);
}

// Pair each check-in day with that day's habit completion count and correlate
// energy against completions. Returns the coefficient + the sample size used.
export function energyVsCompletion(
  checkins: CheckinLite[],
  completionsByDate: Map<string, number>,
): { r: number | null; n: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of checkins) {
    if (!completionsByDate.has(c.date)) continue;
    xs.push(c.energy);
    ys.push(completionsByDate.get(c.date)!);
  }
  return { r: pearson(xs, ys), n: xs.length };
}

// Human label for a correlation strength, sign-aware. Used by the insight card.
export function correlationLabel(r: number): string {
  const a = Math.abs(r);
  const strength = a >= 0.6 ? "strong" : a >= 0.3 ? "moderate" : "weak";
  const dir = r >= 0 ? "positive" : "negative";
  return `${strength} ${dir}`;
}
