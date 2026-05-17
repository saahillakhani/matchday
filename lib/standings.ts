/**
 * Standings aggregation — shared between /api/table and /api/form-grid
 * (and used for the position field on /api/results once we wire that
 * back in).
 *
 * Given every member's predictions and the league's results table,
 * computes per-member per-GW scoring and the season totals. Sort order:
 * pts desc, then bns desc (bonus is the season tiebreaker).
 */

import { aggregate, scorePick, type Aggregate } from "./scoring";

export type RawPick = {
  userId: string;
  gw: number;
  matchIndex: number;
  home: number;
  away: number;
};

export type RawResult = {
  gw: number;
  matchIndex: number;
  home: number;
  away: number;
};

export type Member = {
  userId: string;
  displayName: string;
};

export type PerGw = {
  gw: number;
  points: number;
  bonus: number;
  exacts: number;
  results: number;
  bonuses: number;
};

export type StandingsRow = {
  userId: string;
  displayName: string;
  totals: Aggregate;
  perGw: PerGw[]; // one entry per GW we have data for, sorted ascending
};

/**
 * Compute standings rows for every member, plus the ranked order by
 * (pts desc, bns desc, displayName asc).
 */
export function computeStandings(input: {
  members: Member[];
  picks: RawPick[];
  results: RawResult[];
}): { rows: StandingsRow[]; rankedOrder: string[] } {
  // Index picks by user → gw → matchIndex
  const picksByUserGw = new Map<
    string,
    Map<number, Map<number, { home: number; away: number }>>
  >();
  for (const p of input.picks) {
    let byGw = picksByUserGw.get(p.userId);
    if (!byGw) {
      byGw = new Map();
      picksByUserGw.set(p.userId, byGw);
    }
    let byMatch = byGw.get(p.gw);
    if (!byMatch) {
      byMatch = new Map();
      byGw.set(p.gw, byMatch);
    }
    byMatch.set(p.matchIndex, { home: p.home, away: p.away });
  }

  // Index results by gw → matchIndex
  const resultsByGw = new Map<
    number,
    Map<number, { home: number; away: number }>
  >();
  for (const r of input.results) {
    let byMatch = resultsByGw.get(r.gw);
    if (!byMatch) {
      byMatch = new Map();
      resultsByGw.set(r.gw, byMatch);
    }
    byMatch.set(r.matchIndex, { home: r.home, away: r.away });
  }

  const allGws = Array.from(resultsByGw.keys()).sort((a, b) => a - b);

  const rows: StandingsRow[] = input.members.map((m) => {
    const perGw: PerGw[] = [];
    for (const gw of allGws) {
      const matches = resultsByGw.get(gw)!;
      const userPicks = picksByUserGw.get(m.userId)?.get(gw);
      const outcomes = [];
      for (const [matchIndex, actual] of matches) {
        const pick = userPicks?.get(matchIndex) ?? null;
        outcomes.push(scorePick(pick, actual));
      }
      const agg = aggregate(outcomes);
      perGw.push({
        gw,
        points: agg.points,
        bonus: agg.bonus,
        exacts: agg.exacts,
        results: agg.results,
        bonuses: agg.bonuses,
      });
    }
    const totals = aggregate(
      perGw.flatMap((g) => [
        ...Array(g.exacts).fill({ points: 3, bonus: 0, label: "EXACT" }),
        ...Array(g.results).fill({ points: 1, bonus: 0, label: "RESULT" }),
        ...Array(g.bonuses).fill({ points: 0, bonus: 1, label: "BONUS" }),
      ]),
    );
    return {
      userId: m.userId,
      displayName: m.displayName,
      totals,
      perGw,
    };
  });

  const ranked = [...rows].sort((a, b) => {
    if (b.totals.points !== a.totals.points) {
      return b.totals.points - a.totals.points;
    }
    if (b.totals.bonus !== a.totals.bonus) {
      return b.totals.bonus - a.totals.bonus;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return { rows, rankedOrder: ranked.map((r) => r.userId) };
}
