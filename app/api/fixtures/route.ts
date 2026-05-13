import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFixtures } from "@/lib/fpl";
import { filterByTeams, sortFixtures } from "@/lib/match-key";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const leagueId = searchParams.get("leagueId");
  const gwRaw = searchParams.get("gw");
  const gw = gwRaw ? Number.parseInt(gwRaw, 10) : NaN;

  if (!leagueId) {
    return NextResponse.json(
      { error: "Missing leagueId" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(gw) || gw < 1 || gw > 38) {
    return NextResponse.json(
      { error: "Invalid gw (must be 1–38)" },
      { status: 400 },
    );
  }

  // RLS gates this — non-members get an empty result.
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, selected_teams, locked, current_gw")
    .eq("id", leagueId)
    .single();

  if (leagueError || !league) {
    return NextResponse.json(
      { error: "League not found" },
      { status: 404 },
    );
  }

  const fplFixtures = await getFixtures(gw);
  const relevant = filterByTeams(fplFixtures, league.selected_teams);
  const sorted = sortFixtures(relevant);

  const firstKickoff = sorted[0]?.kickoffTime ?? null;
  const kickoffPassed =
    firstKickoff !== null && new Date(firstKickoff) <= new Date();

  // A GW is locked once either the league row says so OR its first kickoff
  // has passed (in case the cron hasn't run yet). Future GWs are never locked.
  const isCurrentOrPastGw = gw <= league.current_gw;
  const locked =
    isCurrentOrPastGw && (league.locked || kickoffPassed);

  return NextResponse.json({
    fixtures: sorted.map((f) => ({
      matchIndex: f.matchIndex,
      home: f.homeTeam,
      away: f.awayTeam,
      kickoff: f.kickoffTime,
      started: f.started,
      finished: f.finished,
    })),
    firstKickoff,
    locked,
    currentGw: league.current_gw,
  });
}
