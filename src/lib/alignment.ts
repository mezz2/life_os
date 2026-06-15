// Alignment capstone — pure aggregation (Phase 11). Joins the four LifeOS
// signals per Value: TIME (calendar minutes), MONEY (expense $), VOTES (habit
// completions) and ENERGY (avg daily check-in on days you acted on the value).
// No DB here; the /align page does the joins and passes plain shapes so the
// scoring is fully unit-testable. "Unattributed" (valueId null) is tracked so
// shares stay honest.

export type ValueRef = { id: string; name: string };
export type EventLite = { valueId: string | null; durationMin: number };
export type SpendLite = { valueId: string | null; amount: number }; // positive expense magnitude
export type CompletionLite = { valueId: string | null; dateKey: string }; // one per completed habit-log

export type ValueAlignment = {
  id: string;
  name: string;
  minutes: number;
  money: number;
  votes: number;
  energy: number | null; // avg check-in energy on days this value was acted on
  activeDays: number; // distinct days with ≥1 completion for this value
  timeShare: number; // 0..1 of all attributed time
  moneyShare: number; // 0..1 of all attributed money
  voteShare: number; // 0..1 of all attributed votes
  score: number; // 0..1 balanced engagement (see alignmentScore)
};

export type AlignmentReport = {
  values: ValueAlignment[];
  unattributed: { minutes: number; money: number; votes: number };
  totals: { minutes: number; money: number; votes: number };
};

function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

// Balanced engagement: a value scores high only when it gets a fair share across
// the dimensions that exist — not by dominating one. Average of the available
// shares (time, money, votes), so a value with lots of money but no time/votes
// is visibly lopsided rather than flattering.
export function alignmentScore(v: { timeShare: number; moneyShare: number; voteShare: number }): number {
  const parts = [v.timeShare, v.voteShare]; // intent dimensions you control
  // money counts toward alignment but spending on a value isn't the same as
  // living it, so weight it half.
  const weighted = parts.reduce((a, b) => a + b, 0) + v.moneyShare * 0.5;
  const denom = parts.length + 0.5;
  return weighted / denom;
}

export function buildAlignment(
  values: ValueRef[],
  events: EventLite[],
  spend: SpendLite[],
  completions: CompletionLite[],
  energyByDay: Map<string, number>,
): AlignmentReport {
  const minutesBy = new Map<string, number>();
  const moneyBy = new Map<string, number>();
  const votesBy = new Map<string, number>();
  const daysBy = new Map<string, Set<string>>();

  let unMin = 0;
  let unMoney = 0;
  let unVotes = 0;

  for (const e of events) {
    const m = Math.max(0, e.durationMin);
    if (e.valueId) minutesBy.set(e.valueId, (minutesBy.get(e.valueId) ?? 0) + m);
    else unMin += m;
  }
  for (const s of spend) {
    const a = Math.max(0, s.amount);
    if (s.valueId) moneyBy.set(s.valueId, (moneyBy.get(s.valueId) ?? 0) + a);
    else unMoney += a;
  }
  for (const c of completions) {
    if (c.valueId) {
      votesBy.set(c.valueId, (votesBy.get(c.valueId) ?? 0) + 1);
      if (!daysBy.has(c.valueId)) daysBy.set(c.valueId, new Set());
      daysBy.get(c.valueId)!.add(c.dateKey);
    } else {
      unVotes += 1;
    }
  }

  const totMin = [...minutesBy.values()].reduce((a, b) => a + b, 0);
  const totMoney = [...moneyBy.values()].reduce((a, b) => a + b, 0);
  const totVotes = [...votesBy.values()].reduce((a, b) => a + b, 0);

  const valuesOut: ValueAlignment[] = values.map((v) => {
    const minutes = minutesBy.get(v.id) ?? 0;
    const money = moneyBy.get(v.id) ?? 0;
    const votes = votesBy.get(v.id) ?? 0;
    const days = daysBy.get(v.id) ?? new Set<string>();

    let energy: number | null = null;
    if (days.size > 0) {
      const readings = [...days].map((d) => energyByDay.get(d)).filter((x): x is number => typeof x === "number");
      energy = readings.length ? readings.reduce((a, b) => a + b, 0) / readings.length : null;
    }

    const timeShare = share(minutes, totMin);
    const moneyShare = share(money, totMoney);
    const voteShare = share(votes, totVotes);

    return {
      id: v.id,
      name: v.name,
      minutes,
      money,
      votes,
      energy,
      activeDays: days.size,
      timeShare,
      moneyShare,
      voteShare,
      score: alignmentScore({ timeShare, moneyShare, voteShare }),
    };
  });

  // Most balanced/engaged first.
  valuesOut.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return {
    values: valuesOut,
    unattributed: { minutes: unMin, money: unMoney, votes: unVotes },
    totals: { minutes: totMin, money: totMoney, votes: totVotes },
  };
}

// Flag the sharpest mismatch: a value getting a large share of one dimension but
// a small share of another (e.g. you spend on "Health" but give it no time).
// Returns null when nothing is notably lopsided. Used by the insight rule.
export function topMismatch(report: AlignmentReport): { name: string; high: string; low: string; gap: number } | null {
  let best: { name: string; high: string; low: string; gap: number } | null = null;
  for (const v of report.values) {
    const dims: Array<[string, number]> = [
      ["time", v.timeShare],
      ["money", v.moneyShare],
      ["votes", v.voteShare],
    ];
    dims.sort((a, b) => b[1] - a[1]);
    const [hiName, hi] = dims[0];
    const [loName, lo] = dims[2];
    const gap = hi - lo;
    if (hi >= 0.25 && gap >= 0.3 && (!best || gap > best.gap)) {
      best = { name: v.name, high: hiName, low: loName, gap };
    }
  }
  return best;
}
