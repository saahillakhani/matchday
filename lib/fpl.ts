/**
 * FPL public API client. Free, unofficial, no auth.
 *
 * Two cached endpoints:
 *   - bootstrap-static — teams, current event, gameweek metadata.
 *     ~2.6 MB, well over Next's fetch-cache limit; we manage TTL ourselves.
 *   - fixtures — full season fixtures (or filtered by GW).
 *     Tiny payload, but updates during live games, so short TTL.
 */

import type { RawFixture } from "./match-key";

const FPL_BASE = "https://fantasy.premierleague.com/api";
const BOOTSTRAP_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const FIXTURES_TTL_MS = 60 * 1000; // 60s

type BootstrapTeam = {
  id: number;
  name: string;
  short_name: string;
};

type BootstrapEvent = {
  id: number;
  name: string;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
};

type Bootstrap = {
  teams: BootstrapTeam[];
  events: BootstrapEvent[];
};

type FplFixture = {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  kickoff_time: string | null;
  started: boolean | null;
  finished: boolean;
  finished_provisional: boolean;
};

// Fallback list used if FPL is unreachable. Reflects the 2025/26 Premier
// League season. Only kicks in on hard fetch failures.
const FALLBACK_TEAMS = [
  "Arsenal",
  "Aston Villa",
  "Bournemouth",
  "Brentford",
  "Brighton",
  "Burnley",
  "Chelsea",
  "Crystal Palace",
  "Everton",
  "Fulham",
  "Leeds",
  "Liverpool",
  "Man City",
  "Man Utd",
  "Newcastle",
  "Nott'm Forest",
  "Sunderland",
  "Tottenham",
  "West Ham",
  "Wolves",
];

// ── Fetch with retry ──────────────────────────────────────────────

// FPL's public API is occasionally flaky (timeouts, brief 5xx). A few
// retries with backoff turns "page renders empty" into "page renders a
// beat later". 3 attempts, ~300ms / 600ms gaps.
async function fetchJsonWithRetry<T>(
  url: string,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`FPL ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 300 * (i + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("FPL fetch failed");
}

// ── Bootstrap cache ───────────────────────────────────────────────

let bootstrapCache: { data: Bootstrap; fetchedAt: number } | null = null;
let bootstrapInflight: Promise<Bootstrap | null> | null = null;

async function fetchBootstrap(): Promise<Bootstrap | null> {
  if (
    bootstrapCache &&
    Date.now() - bootstrapCache.fetchedAt < BOOTSTRAP_TTL_MS
  ) {
    return bootstrapCache.data;
  }
  if (bootstrapInflight) return bootstrapInflight;

  bootstrapInflight = (async () => {
    try {
      const data = await fetchJsonWithRetry<Bootstrap>(
        `${FPL_BASE}/bootstrap-static/`,
      );
      bootstrapCache = { data, fetchedAt: Date.now() };
      return data;
    } catch {
      // Serve a stale cache rather than nothing, if we ever had one.
      return bootstrapCache?.data ?? null;
    } finally {
      bootstrapInflight = null;
    }
  })();

  return bootstrapInflight;
}

// ── Fixtures cache (per-GW) ───────────────────────────────────────

type FixturesCacheEntry = { data: FplFixture[]; fetchedAt: number };
const fixturesCache = new Map<number, FixturesCacheEntry>();
const fixturesInflight = new Map<number, Promise<FplFixture[] | null>>();

async function fetchFixturesByGw(gw: number): Promise<FplFixture[] | null> {
  const cached = fixturesCache.get(gw);
  if (cached && Date.now() - cached.fetchedAt < FIXTURES_TTL_MS) {
    return cached.data;
  }
  const existing = fixturesInflight.get(gw);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetchJsonWithRetry<FplFixture[]>(
        `${FPL_BASE}/fixtures/?event=${gw}`,
      );
      fixturesCache.set(gw, { data, fetchedAt: Date.now() });
      return data;
    } catch {
      // Fall back to a stale cache for this GW if we have one.
      return fixturesCache.get(gw)?.data ?? null;
    } finally {
      fixturesInflight.delete(gw);
    }
  })();

  fixturesInflight.set(gw, promise);
  return promise;
}

// ── Full-season fixtures cache ────────────────────────────────────

// The /fixtures/ endpoint with no event param returns every fixture in
// the season (~380, small JSON). Used for team form lookups.
let allFixturesCache: { data: FplFixture[]; fetchedAt: number } | null = null;
let allFixturesInflight: Promise<FplFixture[] | null> | null = null;

async function fetchAllFixtures(): Promise<FplFixture[] | null> {
  if (
    allFixturesCache &&
    Date.now() - allFixturesCache.fetchedAt < FIXTURES_TTL_MS
  ) {
    return allFixturesCache.data;
  }
  if (allFixturesInflight) return allFixturesInflight;

  allFixturesInflight = (async () => {
    try {
      const data = await fetchJsonWithRetry<FplFixture[]>(
        `${FPL_BASE}/fixtures/`,
      );
      allFixturesCache = { data, fetchedAt: Date.now() };
      return data;
    } catch {
      return allFixturesCache?.data ?? null;
    } finally {
      allFixturesInflight = null;
    }
  })();

  return allFixturesInflight;
}

// ── Public API ────────────────────────────────────────────────────

export async function getTeams(): Promise<string[]> {
  const data = await fetchBootstrap();
  if (!data) return [...FALLBACK_TEAMS].sort();
  return data.teams.map((t) => t.name).sort();
}

/**
 * Current gameweek per FPL. Returns null if bootstrap is unreachable
 * (callers should fall back to the league's stored current_gw).
 */
export async function getCurrentGw(): Promise<number | null> {
  const data = await fetchBootstrap();
  if (!data) return null;
  const current = data.events.find((e) => e.is_current);
  if (current) return current.id;
  // Between gameweeks FPL marks the upcoming GW with is_next.
  const next = data.events.find((e) => e.is_next);
  return next?.id ?? null;
}

/**
 * The gameweek the Predict screen should default to: the in-progress GW
 * if there is one, otherwise the next GW. (FPL keeps is_current on a
 * finished GW until the next rolls over, so we check the finished flag.)
 */
export async function getDefaultGw(): Promise<number | null> {
  const data = await fetchBootstrap();
  if (!data) return null;
  const current = data.events.find((e) => e.is_current);
  if (current && !current.finished) return current.id;
  const next = data.events.find((e) => e.is_next);
  if (next) return next.id;
  return current?.id ?? null;
}

export type FormResult = {
  gw: number;
  home: boolean;
  result: "W" | "L" | "D";
};

/**
 * A team's last `limit` completed results before `beforeGw`, most recent
 * last. Each entry says whether the team played home and whether they
 * won/lost/drew.
 */
export async function getTeamForm(
  teamName: string,
  beforeGw: number,
  limit = 5,
): Promise<FormResult[]> {
  const [bootstrap, all] = await Promise.all([
    fetchBootstrap(),
    fetchAllFixtures(),
  ]);
  if (!bootstrap || !all) return [];

  const team = bootstrap.teams.find((t) => t.name === teamName);
  if (!team) return [];
  const teamId = team.id;

  const played = all
    .filter(
      (f) =>
        f.finished &&
        f.event !== null &&
        f.event < beforeGw &&
        (f.team_h === teamId || f.team_a === teamId) &&
        f.team_h_score !== null &&
        f.team_a_score !== null,
    )
    .sort((a, b) => (a.event ?? 0) - (b.event ?? 0));

  const recent = played.slice(-limit);

  return recent.map((f) => {
    const home = f.team_h === teamId;
    const us = home ? f.team_h_score! : f.team_a_score!;
    const them = home ? f.team_a_score! : f.team_h_score!;
    const result: "W" | "L" | "D" =
      us > them ? "W" : us < them ? "L" : "D";
    return { gw: f.event!, home, result };
  });
}

/**
 * Fixtures for a gameweek, with team names resolved (not IDs).
 */
export async function getFixtures(gw: number): Promise<RawFixture[]> {
  const [bootstrap, raw] = await Promise.all([
    fetchBootstrap(),
    fetchFixturesByGw(gw),
  ]);

  if (!bootstrap || !raw) return [];

  const idToName = new Map<number, string>(
    bootstrap.teams.map((t) => [t.id, t.name]),
  );

  return raw.flatMap<RawFixture>((f) => {
    const home = idToName.get(f.team_h);
    const away = idToName.get(f.team_a);
    if (!home || !away) return []; // unknown team id — skip defensively
    return [
      {
        fplFixtureId: f.id,
        homeTeam: home,
        awayTeam: away,
        kickoffTime: f.kickoff_time,
        started: Boolean(f.started),
        finished: Boolean(f.finished),
      },
    ];
  });
}

/**
 * Fixture results for a gameweek (only those with reported scores).
 * Used by the cron sync in step 8 to upsert into the results table.
 */
export type FplFixtureWithScore = RawFixture & {
  homeScore: number;
  awayScore: number;
};

export async function getFinishedFixtures(
  gw: number,
): Promise<FplFixtureWithScore[]> {
  const [bootstrap, raw] = await Promise.all([
    fetchBootstrap(),
    fetchFixturesByGw(gw),
  ]);

  if (!bootstrap || !raw) return [];

  const idToName = new Map<number, string>(
    bootstrap.teams.map((t) => [t.id, t.name]),
  );

  return raw.flatMap<FplFixtureWithScore>((f) => {
    if (
      !f.started ||
      f.team_h_score === null ||
      f.team_a_score === null
    ) {
      return [];
    }
    const home = idToName.get(f.team_h);
    const away = idToName.get(f.team_a);
    if (!home || !away) return [];
    return [
      {
        fplFixtureId: f.id,
        homeTeam: home,
        awayTeam: away,
        kickoffTime: f.kickoff_time,
        started: true,
        finished: Boolean(f.finished),
        homeScore: f.team_h_score,
        awayScore: f.team_a_score,
      },
    ];
  });
}
