import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFixtures } from "@/lib/fpl";
import { filterByTeams, sortFixtures } from "@/lib/match-key";
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
    .select("id, name, code, selected_teams, current_gw, locked")
    .eq("id", leagueId)
    .single();

  if (!league) redirect("/");

  // Default to the league's current GW; allow override via ?gw=
  const requestedGw = searchParams.gw
    ? Number.parseInt(searchParams.gw, 10)
    : NaN;
  const gw =
    Number.isInteger(requestedGw) && requestedGw >= 1 && requestedGw <= 38
      ? requestedGw
      : league.current_gw;

  const fplFixtures = await getFixtures(gw);
  const relevant = filterByTeams(fplFixtures, league.selected_teams);
  const sorted = sortFixtures(relevant);

  const firstKickoff = sorted[0]?.kickoffTime ?? null;
  const kickoffPassed =
    firstKickoff !== null && new Date(firstKickoff) <= new Date();
  const isCurrentOrPastGw = gw <= league.current_gw;
  const locked = isCurrentOrPastGw && (league.locked || kickoffPassed);

  const { data: picksData } = await supabase
    .from("predictions")
    .select("match_index, home_score, away_score")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .eq("gw", gw);

  const existingPicks: Record<number, { home: number; away: number }> = {};
  for (const row of picksData ?? []) {
    if (row.home_score !== null && row.away_score !== null) {
      existingPicks[row.match_index] = {
        home: row.home_score,
        away: row.away_score,
      };
    }
  }

  return (
    <PredictForm
      leagueId={league.id}
      leagueName={league.name}
      currentGw={league.current_gw}
      selectedGw={gw}
      locked={locked}
      firstKickoff={firstKickoff}
      fixtures={sorted.map((f) => ({
        matchIndex: f.matchIndex,
        home: f.homeTeam,
        away: f.awayTeam,
        kickoff: f.kickoffTime,
      }))}
      existingPicks={existingPicks}
    />
  );
}
