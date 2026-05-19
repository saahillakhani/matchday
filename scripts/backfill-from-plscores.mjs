#!/usr/bin/env node
/**
 * Backfill The Matchday from the old plscores Supabase project.
 *
 * Reads predictions + results from plscores' league PL2526, creates the
 * matching auth users in The Matchday, then writes everything into a new
 * league called "PL Scores 25/26".
 *
 * The old project is treated as strictly read-only — only .select() is
 * ever called against it. All writes go to the new project.
 *
 * Run:
 *   OLD_SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   node --env-file=.env.local scripts/backfill-from-plscores.mjs
 *
 * Safe to re-run — every write uses upsert or "create if missing"
 * semantics. League stays put once created; user creation is idempotent
 * via email lookup; predictions + results use unique-key upserts.
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────

const OLD_URL = "https://ezgyukgsqgsybgogwvwr.supabase.co";
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OLD_LEAGUE_CODE = "PL2526";
const NEW_LEAGUE_NAME = "PL Scores 25/26";
const NEW_LEAGUE_CODE = "pl2526";

// Optional: only pull predictions/results from this GW onwards. Useful
// when the full read hits PostgREST's row cap. Defaults to 1 (everything).
const FROM_GW = Number(process.env.FROM_GW ?? 1);

// Players: first-name match against the old project, mapped to real emails
// for the new project's auth users.
const PLAYERS = [
  { firstName: "Saahil", email: "saahillakhani@hotmail.co.uk" },
  { firstName: "Raj", email: "rajsmirpuri@gmail.com" },
  { firstName: "Darvesh", email: "darveshdaswani@hotmail.com" },
  { firstName: "Ricky", email: "rickymirpuri@gmail.com" },
  { firstName: "Shiv", email: "shivmahboobani@gmail.com" },
  { firstName: "Dipesh", email: "dipeshmangabhai@gmail.com" },
];

// FPL bootstrap names for the Big Six in the 25/26 season
const SELECTED_TEAMS = [
  "Arsenal",
  "Chelsea",
  "Liverpool",
  "Man City",
  "Man Utd",
  "Spurs",
];

// Old app used several aliases for the same teams. Map any old name back
// to the canonical FPL bootstrap name.
const TEAM_NAME_NORMALISER = new Map([
  ["Arsenal", "Arsenal"],
  ["Chelsea", "Chelsea"],
  ["Liverpool", "Liverpool"],
  ["Manchester City", "Man City"],
  ["Man City", "Man City"],
  ["Manchester United", "Man Utd"],
  ["Man Utd", "Man Utd"],
  ["Man United", "Man Utd"],
  ["Tottenham Hotspur", "Spurs"],
  ["Tottenham", "Spurs"],
  ["Spurs", "Spurs"],
]);

// ── Plumbing ──────────────────────────────────────────────────────

function required(name, value) {
  if (!value) {
    console.error(`✗ Missing env var: ${name}`);
    process.exit(1);
  }
  return value;
}

required("OLD_SUPABASE_SERVICE_ROLE_KEY", OLD_KEY);
required("NEXT_PUBLIC_SUPABASE_URL", NEW_URL);
required("SUPABASE_SERVICE_ROLE_KEY", NEW_KEY);

const old = createClient(OLD_URL, OLD_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fresh = createClient(NEW_URL, NEW_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// FPL helpers — minimal client just for this script.
const FPL_BASE = "https://fantasy.premierleague.com/api";
let bootstrapCache = null;

async function fetchBootstrap() {
  if (bootstrapCache) return bootstrapCache;
  const res = await fetch(`${FPL_BASE}/bootstrap-static/`);
  if (!res.ok) throw new Error(`FPL bootstrap ${res.status}`);
  bootstrapCache = await res.json();
  return bootstrapCache;
}

async function fetchFixturesByGw(gw) {
  const res = await fetch(`${FPL_BASE}/fixtures/?event=${gw}`);
  if (!res.ok) throw new Error(`FPL fixtures gw=${gw} ${res.status}`);
  return res.json();
}

// ── Step 1: Resolve old data ──────────────────────────────────────

// PostgREST in Supabase has a hard row cap (1000). We work around it two
// ways: (1) paginate with .range() so we walk past the cap, and (2)
// optionally filter to a starting GW so the result set fits comfortably
// inside one page when re-running for a slice of the season.
async function readAllRows(table, select, eqColumn, eqValue, minGw) {
  const PAGE = 1000;
  const all = [];
  let from = 0;
  while (true) {
    let q = old
      .from(table)
      .select(select)
      .eq(eqColumn, eqValue)
      .range(from, from + PAGE - 1);
    if (minGw && minGw > 1) q = q.gte("gw", minGw);
    const { data, error } = await q;
    if (error) throw new Error(`${table} read: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function readOldData() {
  console.log("→ Reading old project...");

  const { data: league, error: leagueErr } = await old
    .from("leagues")
    .select("code, name")
    .eq("code", OLD_LEAGUE_CODE)
    .single();
  if (leagueErr || !league)
    throw new Error(`Old league not found: ${leagueErr?.message}`);

  const { data: players, error: playersErr } = await old
    .from("players")
    .select("name, position")
    .eq("league_code", OLD_LEAGUE_CODE)
    .order("position", { ascending: true });
  if (playersErr) throw new Error(`Old players read: ${playersErr.message}`);

  const predictions = await readAllRows(
    "predictions",
    "player_name, gw, match_index, home_score, away_score",
    "league_code",
    OLD_LEAGUE_CODE,
    FROM_GW,
  );

  const results = await readAllRows(
    "results",
    "gw, match_index, home_score, away_score",
    "league_code",
    OLD_LEAGUE_CODE,
    FROM_GW,
  );

  console.log(
    `  league "${league.name}", ${players.length} players, ${predictions.length} predictions, ${results.length} results`,
  );
  return { league, players, predictions, results };
}

// ── Step 2: Match old player names to new auth users ──────────────

async function ensureNewUsers(oldPlayers) {
  console.log("→ Ensuring auth users in The Matchday...");

  const result = new Map(); // firstName (lowercase) → user_id

  for (const player of PLAYERS) {
    const lowered = player.firstName.toLowerCase();

    // Try to find existing user by email
    const { data: list, error: listErr } =
      await fresh.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr)
      throw new Error(`auth listUsers: ${listErr.message}`);

    let user = list.users.find(
      (u) => u.email?.toLowerCase() === player.email.toLowerCase(),
    );

    if (!user) {
      const { data, error } = await fresh.auth.admin.createUser({
        email: player.email,
        email_confirm: true,
        user_metadata: { display_name: player.firstName },
      });
      if (error)
        throw new Error(`createUser ${player.email}: ${error.message}`);
      user = data.user;
      console.log(`  created auth user for ${player.firstName} (${player.email})`);
    } else {
      console.log(`  reused auth user for ${player.firstName}`);
    }

    if (!user) throw new Error(`No user object for ${player.email}`);
    result.set(lowered, user.id);
  }

  // Now match the old players list (by first-name token) into our map.
  const playerNameToUserId = new Map();
  for (const op of oldPlayers) {
    const firstWord = op.name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    const mapped = result.get(firstWord);
    if (!mapped) {
      console.warn(
        `  ⚠ no auth user mapping for old player "${op.name}" (first name "${firstWord}")`,
      );
      continue;
    }
    playerNameToUserId.set(op.name, mapped);
  }

  return { firstNameToUserId: result, playerNameToUserId };
}

// ── Step 3: Create the new league + memberships ───────────────────

async function ensureNewLeague(oldPlayers, playerNameToUserId, firstNameToUserId) {
  console.log("→ Ensuring new league in The Matchday...");

  // Find or create
  const { data: existing } = await fresh
    .from("leagues")
    .select("id, name, base_order, current_gw, locked")
    .eq("code", NEW_LEAGUE_CODE)
    .maybeSingle();

  let leagueId;
  if (existing) {
    leagueId = existing.id;
    console.log(`  reused league ${existing.name} (${leagueId})`);
  } else {
    const creatorId = firstNameToUserId.get("saahil");
    if (!creatorId) throw new Error("Saahil's user id is required as league creator");

    const { data, error } = await fresh
      .from("leagues")
      .insert({
        name: NEW_LEAGUE_NAME,
        code: NEW_LEAGUE_CODE,
        selected_teams: SELECTED_TEAMS,
        created_by: creatorId,
        current_gw: 38,
        locked: false, // GW 38 hasn't kicked off yet; let normal cron flow lock it
      })
      .select()
      .single();
    if (error || !data)
      throw new Error(`create league: ${error?.message}`);
    leagueId = data.id;
    console.log(`  created league ${NEW_LEAGUE_NAME} (${leagueId})`);
  }

  // Memberships in old.players.position order. base_order will be set
  // separately below.
  const baseOrder = [];
  for (const op of oldPlayers) {
    const userId = playerNameToUserId.get(op.name);
    if (!userId) continue;
    baseOrder.push(userId);

    const { error } = await fresh
      .from("league_members")
      .upsert(
        { league_id: leagueId, user_id: userId },
        { onConflict: "league_id,user_id" },
      );
    if (error)
      throw new Error(`add member ${op.name}: ${error.message}`);
  }

  // Set base_order from old players.position so the rotation matches
  // what they actually played all season.
  const { error: orderErr } = await fresh
    .from("leagues")
    .update({ base_order: baseOrder })
    .eq("id", leagueId);
  if (orderErr)
    throw new Error(`set base_order: ${orderErr.message}`);

  console.log(`  base_order set with ${baseOrder.length} members`);
  return leagueId;
}

// ── Step 4: Build the old→new match_index remap per GW ────────────

function canonicalTeam(name) {
  return TEAM_NAME_NORMALISER.get(name) ?? name;
}

function involvesSelectedTeam(fixture, idToName, selectedSet) {
  const home = idToName.get(fixture.team_h);
  const away = idToName.get(fixture.team_a);
  return home && away && (selectedSet.has(home) || selectedSet.has(away));
}

function oldSort(fixtures, idToName) {
  return [...fixtures].sort((a, b) => {
    const ta = new Date(a.kickoff_time || 0).getTime();
    const tb = new Date(b.kickoff_time || 0).getTime();
    if (ta !== tb) return ta - tb;
    const homeA = canonicalTeam(idToName.get(a.team_h) ?? "");
    const homeB = canonicalTeam(idToName.get(b.team_h) ?? "");
    const h = homeA.localeCompare(homeB, "en");
    if (h !== 0) return h;
    const awayA = canonicalTeam(idToName.get(a.team_a) ?? "");
    const awayB = canonicalTeam(idToName.get(b.team_a) ?? "");
    return awayA.localeCompare(awayB, "en");
  });
}

function newSort(fixtures) {
  return [...fixtures].sort((a, b) => {
    const ta = new Date(a.kickoff_time || 0).getTime();
    const tb = new Date(b.kickoff_time || 0).getTime();
    if (ta !== tb) return ta - tb;
    return a.id - b.id;
  });
}

async function buildIndexRemap(gw) {
  const bootstrap = await fetchBootstrap();
  const idToName = new Map(bootstrap.teams.map((t) => [t.id, t.name]));
  const selectedSet = new Set(SELECTED_TEAMS);

  const raw = await fetchFixturesByGw(gw);
  const relevant = raw.filter((f) =>
    involvesSelectedTeam(f, idToName, selectedSet),
  );

  const oldOrdered = oldSort(relevant, idToName);
  const newOrdered = newSort(relevant);

  // Build map: oldIndex → newIndex via fpl fixture id
  const newIndexByFplId = new Map(newOrdered.map((f, i) => [f.id, i]));
  const oldToNew = new Map();
  for (let i = 0; i < oldOrdered.length; i++) {
    const newIdx = newIndexByFplId.get(oldOrdered[i].id);
    if (newIdx !== undefined) oldToNew.set(i, newIdx);
  }
  return oldToNew;
}

// ── Step 5: Migrate predictions + results, GW by GW ───────────────

async function migrateGw(gw, leagueId, oldData, playerNameToUserId, remap) {
  const oldPreds = oldData.predictions.filter((p) => p.gw === gw);
  const oldRes = oldData.results.filter((r) => r.gw === gw);

  const predRows = [];
  for (const p of oldPreds) {
    const userId = playerNameToUserId.get(p.player_name);
    if (!userId) continue;
    if (p.home_score === null || p.away_score === null) continue;
    const newIdx = remap.get(p.match_index);
    if (newIdx === undefined) continue;
    predRows.push({
      league_id: leagueId,
      user_id: userId,
      gw,
      match_index: newIdx,
      home_score: p.home_score,
      away_score: p.away_score,
    });
  }

  const resRows = [];
  for (const r of oldRes) {
    if (r.home_score === null || r.away_score === null) continue;
    const newIdx = remap.get(r.match_index);
    if (newIdx === undefined) continue;
    resRows.push({
      league_id: leagueId,
      gw,
      match_index: newIdx,
      home_score: r.home_score,
      away_score: r.away_score,
    });
  }

  if (predRows.length > 0) {
    const { error } = await fresh
      .from("predictions")
      .upsert(predRows, { onConflict: "league_id,user_id,gw,match_index" });
    if (error)
      throw new Error(`GW ${gw} predictions upsert: ${error.message}`);
  }
  if (resRows.length > 0) {
    const { error } = await fresh
      .from("results")
      .upsert(resRows, { onConflict: "league_id,gw,match_index" });
    if (error)
      throw new Error(`GW ${gw} results upsert: ${error.message}`);
  }

  return { predictionsWritten: predRows.length, resultsWritten: resRows.length };
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const oldData = await readOldData();
  const { firstNameToUserId, playerNameToUserId } =
    await ensureNewUsers(oldData.players);
  const leagueId = await ensureNewLeague(
    oldData.players,
    playerNameToUserId,
    firstNameToUserId,
  );

  // Lock the historical GWs by marking the league as advanced through them
  // — but the cron is what manages current_gw + locked. We set
  // current_gw=38 already (in ensureNewLeague), so all earlier GWs are
  // "past" and the predictions API blocks edits to them.

  const gws = new Set();
  for (const p of oldData.predictions) gws.add(p.gw);
  for (const r of oldData.results) gws.add(r.gw);
  const sortedGws = Array.from(gws).sort((a, b) => a - b);

  console.log(`→ Migrating ${sortedGws.length} gameweeks...`);

  let totalPreds = 0;
  let totalRes = 0;
  for (const gw of sortedGws) {
    const remap = await buildIndexRemap(gw);
    const { predictionsWritten, resultsWritten } = await migrateGw(
      gw,
      leagueId,
      oldData,
      playerNameToUserId,
      remap,
    );
    console.log(
      `  GW ${String(gw).padStart(2, "0")} · preds=${predictionsWritten} results=${resultsWritten}`,
    );
    totalPreds += predictionsWritten;
    totalRes += resultsWritten;
  }

  console.log(`\n✓ Done. ${totalPreds} predictions, ${totalRes} results migrated.`);
  console.log(`  New league: ${NEW_LEAGUE_NAME} (id ${leagueId}, code ${NEW_LEAGUE_CODE})`);
}

main().catch((err) => {
  console.error("\n✗ Backfill failed:", err.message);
  process.exit(1);
});
