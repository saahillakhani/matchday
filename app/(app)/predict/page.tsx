import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultGw,
  getFixtures,
  getTeamForm,
  type FormResult,
} from "@/lib/fpl";
import { filterByTeams, sortFixtures } from "@/lib/match-key";
import {
  abbreviateName,
  isStarter,
  rotationForGw,
} from "@/lib/rotation";
import { PredictForm } from "./form";

export default async function PredictPage({
  searchParams,
}: {
  searchParams: { leagueId?: string; gw?: string };
}) {
  const leagueId = searchParams.leagueId;
  if (!leagueId) redirect("/");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // (app) layout already gates auth — this is belt-and-braces.
  if (!user) redirect("/sign-in");

  // RLS gates this — non-members get nothing and we send them home.
  const { data: league } = await supabase
    .from("leagues")
    .select(
      "id, name, code, selected_teams, current_gw, locked, base_order",
    )
    .eq("id", leagueId)
    .single();

  if (!league) redirect("/");

  // If ?gw= is given, honour it. Otherwise default to the GW in progress
  // (or the next GW if we're between gameweeks), falling back to the
  // league's stored current_gw if FPL is unreachable.
  const requestedGw = searchParams.gw
    ? Number.parseInt(searchParams.gw, 10)
    : NaN;
  let gw: number;
  if (Number.isInteger(requestedGw) && requestedGw >= 1 && requestedGw <= 38) {
    gw = requestedGw;
  } else {
    gw = (await getDefaultGw()) ?? league.current_gw;
  }

  const fplFixtures = await getFixtures(gw);
  const relevant = filterByTeams(fplFixtures, league.selected_teams);
  const sorted = sortFixtures(relevant);

  const firstKickoff = sorted[0]?.kickoffTime ?? null;
  const kickoffPassed =
    firstKickoff !== null && new Date(firstKickoff) <= new Date();
  const isCurrentOrPastGw = gw <= league.current_gw;
  const locked = isCurrentOrPastGw && (league.locked || kickoffPassed);

  // Fetch every member's picks for this GW (one league/GW worth of rows —
  // well under any row cap) plus the member roster, so we can render the
  // rotation chips and work out who's still "on the clock".
  type MemberRow = {
    user_id: string | null;
    profiles: { display_name: string } | null;
  };

  const [{ data: gwPicks }, { data: membersData }, { data: gwSubs }] =
    await Promise.all([
      supabase
        .from("predictions")
        .select("user_id, match_index, home_score, away_score")
        .eq("league_id", leagueId)
        .eq("gw", gw),
      supabase
        .from("league_members")
        .select("user_id, profiles(display_name)")
        .eq("league_id", leagueId),
      supabase
        .from("submissions")
        .select("user_id")
        .eq("league_id", leagueId)
        .eq("gw", gw),
    ]);

  const existingPicks: Record<number, { home: number; away: number }> = {};
  for (const row of gwPicks ?? []) {
    if (row.home_score === null || row.away_score === null) continue;
    if (row.user_id === user.id) {
      existingPicks[row.match_index] = {
        home: row.home_score,
        away: row.away_score,
      };
    }
  }

  const nameByUserId = new Map<string, string>();
  for (const m of (membersData ?? []) as MemberRow[]) {
    if (m.user_id) {
      nameByUserId.set(m.user_id, m.profiles?.display_name ?? "—");
    }
  }

  const submittedIds = new Set(
    (gwSubs ?? []).map((s) => s.user_id).filter((id): id is string => !!id),
  );
  const iHaveSubmitted = submittedIds.has(user.id);

  // Rotation for this GW. "On the clock" = first member in rotation order
  // who hasn't SUBMITTED yet. No marker on a locked GW.
  const baseOrder = (league.base_order ?? []) as string[];
  const rotationIds = rotationForGw(baseOrder, gw);
  const onClockId = locked
    ? null
    : rotationIds.find((uid) => !submittedIds.has(uid)) ?? null;

  const rotation = rotationIds.map((uid) => ({
    userId: uid,
    displayName: nameByUserId.get(uid) ?? "—",
    abbr: abbreviateName(nameByUserId.get(uid) ?? "—"),
    isStarter: isStarter(rotationIds, uid),
    isOnClock: uid === onClockId,
    hasSubmitted: submittedIds.has(uid),
  }));

  // Last-5 form for each team in the GW's fixtures. Computed once per
  // distinct team so a team appearing twice isn't fetched twice.
  const teamNames = Array.from(
    new Set(sorted.flatMap((f) => [f.homeTeam, f.awayTeam])),
  );
  const formEntries = await Promise.all(
    teamNames.map(
      async (name) => [name, await getTeamForm(name, gw)] as const,
    ),
  );
  const formByTeam = new Map<string, FormResult[]>(formEntries);

  return (
    <PredictForm
      userId={user.id}
      leagueId={league.id}
      leagueName={league.name}
      currentGw={league.current_gw}
      selectedGw={gw}
      locked={locked}
      submitted={iHaveSubmitted}
      firstKickoff={firstKickoff}
      rotation={rotation}
      fixtures={sorted.map((f) => ({
        matchIndex: f.matchIndex,
        home: f.homeTeam,
        away: f.awayTeam,
        kickoff: f.kickoffTime,
        homeForm: formByTeam.get(f.homeTeam) ?? [],
        awayForm: formByTeam.get(f.awayTeam) ?? [],
      }))}
      existingPicks={existingPicks}
    />
  );
}
