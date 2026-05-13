/**
 * Deterministic fixture ordering.
 *
 * This file owns the contract that ties `predictions.match_index` to
 * `results.match_index`. The fixtures API and the cron sync MUST both
 * call `sortFixtures` so they assign the same match_index to the same
 * underlying FPL fixture, every time.
 *
 * Sort key:
 *   1. kickoff_time ascending  (null/missing kickoffs sort last)
 *   2. fplFixtureId ascending  (stable tiebreaker for same-kickoff games)
 *
 * Do not introduce other tiebreakers or change ordering without a
 * migration plan — existing predictions are stored against the current
 * match_index assignments.
 */

export type RawFixture = {
  fplFixtureId: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string | null; // ISO 8601 or null if TBD
  started: boolean;
  finished: boolean;
};

export type SortedFixture = RawFixture & {
  matchIndex: number;
};

export function sortFixtures(fixtures: RawFixture[]): SortedFixture[] {
  const cmp = (a: RawFixture, b: RawFixture): number => {
    const aKick = a.kickoffTime ?? "￿"; // missing sorts last
    const bKick = b.kickoffTime ?? "￿";
    if (aKick !== bKick) return aKick < bKick ? -1 : 1;
    return a.fplFixtureId - b.fplFixtureId;
  };

  return [...fixtures]
    .sort(cmp)
    .map((fixture, matchIndex) => ({ ...fixture, matchIndex }));
}

/**
 * Filter fixtures to those involving any of the league's selected teams.
 * Match by team name strings (FPL bootstrap.name, e.g. "Arsenal").
 */
export function filterByTeams(
  fixtures: RawFixture[],
  selectedTeams: string[],
): RawFixture[] {
  const set = new Set(selectedTeams);
  return fixtures.filter(
    (f) => set.has(f.homeTeam) || set.has(f.awayTeam),
  );
}
