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
  const { all, finished } = await fixtureSource(league.current_gw);

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

    const baseOrder = fisherYatesShuffle(memberIds);
    await supabase
      .from("leagues")
      .update({ base_order: baseOrder, locked: true })
      .eq("id", league.id);
    return {
      leagueId: league.id,
      fromGw,
      action: "locked",
      details: { memberCount: memberIds.length },
    };
  }

  // c. Upsert results for any finished fixtures
  const matchIndexByFplId = new Map(
    sorted.map((f) => [f.fplFixtureId, f.matchIndex]),
  );

  const resultRows: Array<{
    league_id: string;
    gw: number;
    match_index: number;
    home_score: number;
    away_score: number;
  }> = [];

  for (const f of finished) {
    const matchIndex = matchIndexByFplId.get(f.fplFixtureId);
    if (matchIndex === undefined) continue;
    resultRows.push({
      league_id: league.id,
      gw: league.current_gw,
      match_index: matchIndex,
      home_score: f.homeScore,
      away_score: f.awayScore,
    });
  }

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
