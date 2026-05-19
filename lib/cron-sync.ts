/**
 * Cron sync logic — shared between the live cron endpoint and the
 * simulation harness so they run the same code path.
 *
 * For each league, in order:
 *   a. Compute the current GW's fixtures (filter to selected_teams, sort).
 *   b. If first kickoff has passed and the league isn't locked yet,
 *      shuffle the members and lock. (1-member leagues still lock —
 *      gameplay works for a rotation of one.)
 *   c. Upsert any results from started fixtures (using the same
 *      match_index as predictions).
 *   d. If every fixture in the GW has finished, advance current_gw and
 *      reset locked so the next GW can lock fresh.
 *
 * Fixture fetching is factored out so the sim can inject canned data.
 * Pass `liveFixtureSource` for the prod path; pass any function for
 * tests.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getFinishedFixtures,
  getFixtures,
  type FplFixtureWithScore,
} from "./fpl";
import {
  filterByTeams,
  sortFixtures,
  type RawFixture,
} from "./match-key";
import { fisherYatesShuffle } from "./shuffle";

type LeagueRow = {
  id: string;
  current_gw: number;
  selected_teams: string[];
  base_order: string[];
  locked: boolean;
};

export type SyncAction =
  | "noop"
  | "locked"
  | "wrote-results"
  | "advanced-all-finished"
  | "advanced-blank-gw"
  | "advanced-no-members";

export type SyncReport = {
  leagueId: string;
  fromGw: number;
  action: SyncAction;
  details?: Record<string, unknown>;
};

export type FixtureSource = (gw: number) => Promise<{
  all: RawFixture[];
  finished: FplFixtureWithScore[];
}>;

/**
 * Default fixture source: hits the live FPL API via lib/fpl.ts. The sim
 * passes its own source instead.
 */
export const liveFixtureSource: FixtureSource = async (gw) => {
  const [all, finished] = await Promise.all([
    getFixtures(gw),
    getFinishedFixtures(gw),
  ]);
  return { all, finished };
};

export async function syncAllLeagues(
  supabase: SupabaseClient<Database>,
  fixtureSource: FixtureSource = liveFixtureSource,
  now: Date = new Date(),
): Promise<SyncReport[]> {
  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("id, current_gw, selected_teams, base_order, locked");

  if (error) {
    throw new Error(`Failed to fetch leagues: ${error.message}`);
  }

  const reports: SyncReport[] = [];
  for (const league of leagues ?? []) {
    const report = await syncLeague(
      supabase,
      league as LeagueRow,
      fixtureSource,
      now,
    );
    reports.push(report);
  }
  return reports;
}

export async function syncLeague(
  supabase: SupabaseClient<Database>,
  league: LeagueRow,
  fixtureSource: FixtureSource,
  now: Date,
): Promise<SyncReport> {
  const fromGw = league.current_gw;
  const { all } = await fixtureSource(league.current_gw);

  // a. Filter + sort to this league's relevant fixtures
  const relevant = filterByTeams(all, league.selected_teams);
  const sorted = sortFixtures(relevant);

  // Blank GW (no fixtures for the chosen teams): advance and return.
  if (sorted.length === 0) {
    await supabase
      .from("leagues")
      .update({ current_gw: league.current_gw + 1, locked: false })
      .eq("id", league.id);
    return { leagueId: league.id, fromGw, action: "advanced-blank-gw" };
  }

  const firstKickoff = sorted[0].kickoffTime;
  const kickoffPassed =
    firstKickoff !== null && new Date(firstKickoff) <= now;

  // b. Lock the league at first kickoff (if still unlocked)
  if (kickoffPassed && !league.locked) {
    const { data: members } = await supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", league.id)
      .order("joined_at", { ascending: true });

    const memberIds = (members ?? [])
      .map((m) => m.user_id)
      .filter((id): id is string => id !== null);

    if (memberIds.length === 0) {
      // No members — just advance, nothing to lock.
      await supabase
        .from("leagues")
        .update({ current_gw: league.current_gw + 1, locked: false })
        .eq("id", league.id);
      return { leagueId: league.id, fromGw, action: "advanced-no-members" };
    }

    // base_order is the season-long rotation seed — shuffled ONCE, the
    // first time the league locks. Every later gameweek's order is just
    // base_order rotated by (gw-1). If it's already set (e.g. a returning
    // league, or a backfilled one), keep it — never reshuffle.
    const baseOrder =
      league.base_order.length > 0
        ? league.base_order
        : fisherYatesShuffle(memberIds);
    await supabase
      .from("leagues")
      .update({ base_order: baseOrder, locked: true })
      .eq("id", league.id);

    // Auto-submit at kickoff: anyone who saved draft picks for this GW but
    // never pressed Submit gets an auto submission so they don't miss out.
    const autoSubmitted = await autoSubmitDrafts(
      supabase,
      league.id,
      league.current_gw,
      memberIds,
    );

    return {
      leagueId: league.id,
      fromGw,
      action: "locked",
      details: {
        memberCount: memberIds.length,
        autoSubmitted,
      },
    };
  }

  // c. Upsert results for finished fixtures — for the current GW AND the
  //    one before it. The previous GW catches late results (a Monday
  //    night game, a postponed fixture played out of sequence) that land
  //    after current_gw has already moved on, which would otherwise
  //    leave that gameweek permanently missing a result.
  const resultRows = [
    ...(await collectResultRows(
      league.id,
      league.current_gw,
      league.selected_teams,
      fixtureSource,
    )),
    ...(await collectResultRows(
      league.id,
      league.current_gw - 1,
      league.selected_teams,
      fixtureSource,
    )),
  ];

  if (resultRows.length > 0) {
    const { error: upsertError } = await supabase
      .from("results")
      .upsert(resultRows, {
        onConflict: "league_id,gw,match_index",
      });
    if (upsertError) {
      throw new Error(
        `Failed to upsert results for league ${league.id}: ${upsertError.message}`,
      );
    }
  }

  // d. If every fixture has finished, roll forward to the next GW
  const allFinished = sorted.every((f) => f.finished === true);
  if (allFinished) {
    await supabase
      .from("leagues")
      .update({ current_gw: league.current_gw + 1, locked: false })
      .eq("id", league.id);
    return {
      leagueId: league.id,
      fromGw,
      action: "advanced-all-finished",
      details: { resultsWritten: resultRows.length },
    };
  }

  if (resultRows.length > 0) {
    return {
      leagueId: league.id,
      fromGw,
      action: "wrote-results",
      details: { count: resultRows.length },
    };
  }

  return { leagueId: league.id, fromGw, action: "noop" };
}

type ResultRow = {
  league_id: string;
  gw: number;
  match_index: number;
  home_score: number;
  away_score: number;
};

/**
 * Result rows for a single gameweek — finished fixtures involving the
 * league's teams, keyed to the same match_index the predictions use.
 */
async function collectResultRows(
  leagueId: string,
  gw: number,
  selectedTeams: string[],
  fixtureSource: FixtureSource,
): Promise<ResultRow[]> {
  if (gw < 1) return [];
  const { all, finished } = await fixtureSource(gw);
  const sorted = sortFixtures(filterByTeams(all, selectedTeams));
  const indexByFplId = new Map(
    sorted.map((f) => [f.fplFixtureId, f.matchIndex]),
  );
  const rows: ResultRow[] = [];
  for (const f of finished) {
    const matchIndex = indexByFplId.get(f.fplFixtureId);
    if (matchIndex === undefined) continue;
    rows.push({
      league_id: leagueId,
      gw,
      match_index: matchIndex,
      home_score: f.homeScore,
      away_score: f.awayScore,
    });
  }
  return rows;
}

/**
 * At kickoff, auto-submit anyone who saved draft picks for the GW but
 * never pressed Submit. Returns the count of users auto-submitted.
 * Idempotent — uses upsert on the submissions unique key.
 */
async function autoSubmitDrafts(
  supabase: SupabaseClient<Database>,
  leagueId: string,
  gw: number,
  memberIds: string[],
): Promise<number> {
  // Members with at least one prediction for this GW.
  const { data: predRows } = await supabase
    .from("predictions")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("gw", gw);
  const withPicks = new Set(
    (predRows ?? [])
      .map((r) => r.user_id)
      .filter((id): id is string => !!id),
  );

  // Members who already have a submission for this GW.
  const { data: subRows } = await supabase
    .from("submissions")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("gw", gw);
  const alreadySubmitted = new Set(
    (subRows ?? [])
      .map((r) => r.user_id)
      .filter((id): id is string => !!id),
  );

  const toAutoSubmit = memberIds.filter(
    (id) => withPicks.has(id) && !alreadySubmitted.has(id),
  );
  if (toAutoSubmit.length === 0) return 0;

  const { error } = await supabase.from("submissions").upsert(
    toAutoSubmit.map((userId) => ({
      league_id: leagueId,
      user_id: userId,
      gw,
      auto: true,
    })),
    { onConflict: "league_id,user_id,gw" },
  );
  if (error) {
    throw new Error(
      `Auto-submit failed for league ${leagueId} gw ${gw}: ${error.message}`,
    );
  }
  return toAutoSubmit.length;
}
