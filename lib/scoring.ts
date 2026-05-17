/**
 * Scoring for a single match.
 *
 *   exact score      → 3 points
 *   right result     → 1 point
 *   wrong result     → 0 points (bonus available if one team's score was right)
 *
 * Bonus is tracked separately, never folded into the main total. It's the
 * tiebreaker at season end.
 *
 * Test cases (manual):
 *   scorePick({h:2,a:1}, {h:2,a:1}) → { points: 3, bonus: 0, label: 'EXACT' }
 *   scorePick({h:2,a:0}, {h:2,a:1}) → { points: 1, bonus: 0, label: 'RESULT' }
 *   scorePick({h:1,a:1}, {h:2,a:2}) → { points: 1, bonus: 0, label: 'RESULT' }
 *   scorePick({h:3,a:0}, {h:1,a:1}) → { points: 0, bonus: 0, label: '0' }
 *   scorePick({h:0,a:1}, {h:0,a:2}) → { points: 0, bonus: 1, label: 'BONUS' }
 *   scorePick(null,    {h:1,a:0})   → { points: 0, bonus: 0, label: '—' }
 *   scorePick({h:1,a:0}, null)      → { points: 0, bonus: 0, label: '—' }
 */

export type Score = { home: number; away: number };

export type ScoreLabel = "EXACT" | "RESULT" | "BONUS" | "0" | "—";

export type Outcome = {
  points: 0 | 1 | 3;
  bonus: 0 | 1;
  label: ScoreLabel;
};

export function scorePick(
  pred: Score | null,
  actual: Score | null,
): Outcome {
  if (!pred || !actual) return { points: 0, bonus: 0, label: "—" };

  if (pred.home === actual.home && pred.away === actual.away) {
    return { points: 3, bonus: 0, label: "EXACT" };
  }

  const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
  if (sign(pred.home - pred.away) === sign(actual.home - actual.away)) {
    return { points: 1, bonus: 0, label: "RESULT" };
  }

  // Wrong result — only path where a bonus can be earned.
  const bonus: 0 | 1 =
    pred.home === actual.home || pred.away === actual.away ? 1 : 0;
  return { points: 0, bonus, label: bonus ? "BONUS" : "0" };
}

export type Aggregate = {
  points: number;
  bonus: number;
  exacts: number;
  results: number;
  bonuses: number;
};

export function aggregate(rows: Outcome[]): Aggregate {
  return rows.reduce<Aggregate>(
    (a, r) => ({
      points: a.points + r.points,
      bonus: a.bonus + r.bonus,
      exacts: a.exacts + (r.label === "EXACT" ? 1 : 0),
      results: a.results + (r.label === "RESULT" ? 1 : 0),
      bonuses: a.bonuses + (r.label === "BONUS" ? 1 : 0),
    }),
    { points: 0, bonus: 0, exacts: 0, results: 0, bonuses: 0 },
  );
}
