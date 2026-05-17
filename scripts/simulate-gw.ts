/**
 * Simulation harness for the cron sync logic.
 *
 * Creates throwaway test users + a test league, then drives them through
 * a sequence of gameweek state transitions using mocked FPL data. The
 * sim exercises lib/cron-sync.ts directly with an injected fixture
 * source — no FPL network calls, no real-time clock dependency, no risk
 * to the real league.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/simulate-gw.ts
 *
 * The script cleans up after itself even if assertions fail. If it
 * crashes mid-run the leftover users + league live under emails ending
 * "@matchday-sim.local" — safe to delete manually.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import {
  liveFixtureSource as _live,
  syncAllLeagues,
  type FixtureSource,
} from "../lib/cron-sync";
import { rotationForGw } from "../lib/rotation";

void _live; // suppress unused warning; we export it for the cron route

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SIM_TEAMS = [
  "Arsenal",
  "Chelsea",
  "Liverpool",
  "Man City",
  "Man Utd",
  "Tottenham",
];

const SIM_EMAIL_DOMAIN = "@matchday-sim.local";

// Mock fixtures keyed by gw. Each gw has a fixed kickoff time so we can
// "advance the clock" by passing different `now` values to syncAllLeagues.
type MockFixture = {
  fplFixtureId: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  started: boolean;
  finished: boolean;
  homeScore?: number;
  awayScore?: number;
};

let mockState: Record<number, MockFixture[]> = {};

const mockFixtureSource: FixtureSource = async (gw) => {
  const fixtures = mockState[gw] ?? [];
  return {
    all: fixtures.map((f) => ({
      fplFixtureId: f.fplFixtureId,
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      kickoffTime: f.kickoffTime,
      started: f.started,
      finished: f.finished,
    })),
    finished: fixtures
      .filter((f) => f.homeScore !== undefined && f.awayScore !== undefined)
      .map((f) => ({
        fplFixtureId: f.fplFixtureId,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        kickoffTime: f.kickoffTime,
        started: f.started,
        finished: f.finished,
        homeScore: f.homeScore!,
        awayScore: f.awayScore!,
      })),
  };
};

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log("→ Setting up sim...");
  const { userIds, leagueId } = await setup();
  console.log(`  created ${userIds.length} users, league ${leagueId}`);

  try {
    await scenario1_lockAndAdvance(userIds, leagueId);
    await scenario2_rotationAndPartialResults(leagueId);
    await scenario3_blankGw(leagueId);
    console.log("\n✓ All scenarios passed");
  } finally {
    console.log("\n→ Cleaning up...");
    await cleanup(userIds, leagueId);
    console.log("  done");
  }
}

// ── Scenarios ─────────────────────────────────────────────────────

async function scenario1_lockAndAdvance(userIds: string[], leagueId: string) {
  console.log("\n▸ Scenario 1: GW1 locks, results land, GW advances");

  mockState = {
    1: [
      f(101, "Arsenal", "Chelsea", "2026-08-15T18:00:00Z"),
      f(102, "Liverpool", "Man City", "2026-08-16T14:00:00Z"),
    ],
  };

  // Pre-kickoff: nothing should happen.
  const before = await syncAllLeagues(
    supabase,
    mockFixtureSource,
    new Date("2026-08-15T12:00:00Z"),
  );
  assertAction(before, leagueId, "noop");

  // Past kickoff: league should lock, base_order set, current_gw still 1.
  const lockReports = await syncAllLeagues(
    supabase,
    mockFixtureSource,
    new Date("2026-08-15T18:01:00Z"),
  );
  assertAction(lockReports, leagueId, "locked");

  const lockedRow = await readLeague(leagueId);
  if (!lockedRow.locked) throw new Error("expected locked=true");
  if (lockedRow.base_order.length !== userIds.length) {
    throw new Error(
      `expected base_order length ${userIds.length}, got ${lockedRow.base_order.length}`,
    );
  }
  for (const id of userIds) {
    if (!lockedRow.base_order.includes(id)) {
      throw new Error(`base_order missing user ${id}`);
    }
  }

  // Add some results, run again: should write results without advancing.
  mockState[1][0] = { ...mockState[1][0], started: true, homeScore: 2, awayScore: 1 };
  const partial = await syncAllLeagues(
    supabase,
    mockFixtureSource,
    new Date("2026-08-15T20:00:00Z"),
  );
  assertAction(partial, leagueId, "wrote-results");

  // Mark both finished: should advance current_gw, unlock.
  mockState[1][0] = { ...mockState[1][0], finished: true };
  mockState[1][1] = {
    ...mockState[1][1],
    started: true,
    finished: true,
    homeScore: 0,
    awayScore: 3,
  };
  const advance = await syncAllLeagues(
    supabase,
    mockFixtureSource,
    new Date("2026-08-16T17:00:00Z"),
  );
  assertAction(advance, leagueId, "advanced-all-finished");

  const advancedRow = await readLeague(leagueId);
  if (advancedRow.current_gw !== 2)
    throw new Error(`expected current_gw=2, got ${advancedRow.current_gw}`);
  if (advancedRow.locked)
    throw new Error("expected locked=false after advance");

  // Results should be present.
  const { data: results } = await supabase
    .from("results")
    .select("match_index, home_score, away_score")
    .eq("league_id", leagueId)
    .eq("gw", 1)
    .order("match_index");
  if ((results ?? []).length !== 2)
    throw new Error(`expected 2 results, got ${(results ?? []).length}`);

  console.log("  ✓ lock, write, advance");
}

async function scenario2_rotationAndPartialResults(leagueId: string) {
  console.log("\n▸ Scenario 2: GW2 rotation is correctly shifted");

  const beforeRow = await readLeague(leagueId);
  if (beforeRow.current_gw !== 2)
    throw new Error("scenario 2 requires current_gw=2 from scenario 1");
  if (!beforeRow.base_order.length)
    throw new Error("scenario 2 requires base_order from scenario 1");

  mockState[2] = [
    f(201, "Tottenham", "Arsenal", "2026-08-22T15:00:00Z"),
  ];

  // Pre-kickoff: noop (league is unlocked + future kickoff)
  const pre = await syncAllLeagues(
    supabase,
    mockFixtureSource,
    new Date("2026-08-22T10:00:00Z"),
  );
  assertAction(pre, leagueId, "noop");

  // Past kickoff: should re-lock for GW2 with the SAME base_order.
  const post = await syncAllLeagues(
    supabase,
    mockFixtureSource,
    new Date("2026-08-22T15:30:00Z"),
  );
  assertAction(post, leagueId, "locked");

  const lockedRow = await readLeague(leagueId);
  // base_order shouldn't change between GWs once set
  const sameOrder =
    lockedRow.base_order.length === beforeRow.base_order.length &&
    lockedRow.base_order.every((id, i) => id === beforeRow.base_order[i]);
  if (!sameOrder)
    throw new Error("base_order changed between gameweeks (it shouldn't)");

  // Verify rotation library produces shifted order for GW2
  const gw1Rotation = rotationForGw(lockedRow.base_order, 1);
  const gw2Rotation = rotationForGw(lockedRow.base_order, 2);
  if (gw1Rotation[0] === gw2Rotation[0] && gw1Rotation.length > 1) {
    throw new Error("rotationForGw should shift first picker between GWs");
  }

  console.log("  ✓ relocks with same base_order, rotation shifts");
}

async function scenario3_blankGw(leagueId: string) {
  console.log("\n▸ Scenario 3: blank GW (no relevant fixtures) auto-advances");

  // Finish GW2 to get us to GW3.
  mockState[2][0] = {
    ...mockState[2][0],
    started: true,
    finished: true,
    homeScore: 1,
    awayScore: 1,
  };
  await syncAllLeagues(
    supabase,
    mockFixtureSource,
    new Date("2026-08-22T17:00:00Z"),
  );

  const before = await readLeague(leagueId);
  if (before.current_gw !== 3)
    throw new Error(`expected current_gw=3 after finishing GW2`);

  // GW3 has no fixtures involving any selected team.
  mockState[3] = [
    f(301, "Brentford", "Brighton", "2026-08-29T15:00:00Z"),
  ];

  const reports = await syncAllLeagues(
    supabase,
    mockFixtureSource,
    new Date("2026-08-29T16:00:00Z"),
  );
  assertAction(reports, leagueId, "advanced-blank-gw");

  const after = await readLeague(leagueId);
  if (after.current_gw !== 4)
    throw new Error(`expected current_gw=4 after blank GW, got ${after.current_gw}`);

  console.log("  ✓ blank GW skipped");
}

// ── Helpers ───────────────────────────────────────────────────────

async function setup() {
  // Create three throwaway users via auth admin
  const stamp = Date.now();
  const userIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const email = `sim-user-${stamp}-${i}${SIM_EMAIL_DOMAIN}`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: `Sim${i + 1}` },
    });
    if (error || !data.user)
      throw new Error(`Failed to create sim user: ${error?.message}`);
    userIds.push(data.user.id);
  }

  // Create a sim league + memberships
  const code = `sim${stamp.toString(36).slice(-5)}`;
  const { data: league, error: leagueErr } = await supabase
    .from("leagues")
    .insert({
      name: `Sim ${stamp}`,
      code,
      selected_teams: SIM_TEAMS,
      created_by: userIds[0],
      current_gw: 1,
    })
    .select()
    .single();
  if (leagueErr || !league)
    throw new Error(`Failed to create sim league: ${leagueErr?.message}`);

  for (const userId of userIds) {
    const { error } = await supabase
      .from("league_members")
      .insert({ league_id: league.id, user_id: userId });
    if (error)
      throw new Error(`Failed to add sim member: ${error.message}`);
  }

  return { userIds, leagueId: league.id };
}

async function cleanup(userIds: string[], leagueId: string) {
  // Cascading deletes handle league_members, predictions, results, profiles.
  await supabase.from("leagues").delete().eq("id", leagueId);
  for (const id of userIds) {
    await supabase.auth.admin.deleteUser(id);
  }
}

async function readLeague(leagueId: string) {
  const { data, error } = await supabase
    .from("leagues")
    .select("id, current_gw, locked, base_order")
    .eq("id", leagueId)
    .single();
  if (error || !data) throw new Error(`Failed to read league: ${error?.message}`);
  return data as {
    id: string;
    current_gw: number;
    locked: boolean;
    base_order: string[];
  };
}

type SyncReportLike = { leagueId: string; action: string };
function assertAction(
  reports: SyncReportLike[],
  leagueId: string,
  expected: string,
) {
  const r = reports.find((x) => x.leagueId === leagueId);
  if (!r) throw new Error(`No report for league ${leagueId}`);
  if (r.action !== expected)
    throw new Error(
      `Expected action="${expected}" for ${leagueId}, got "${r.action}"`,
    );
}

function f(
  id: number,
  home: string,
  away: string,
  kickoff: string,
): MockFixture {
  return {
    fplFixtureId: id,
    homeTeam: home,
    awayTeam: away,
    kickoffTime: kickoff,
    started: false,
    finished: false,
  };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

main().catch((err) => {
  console.error("\n✗ Sim failed:", err.message);
  process.exit(1);
});
