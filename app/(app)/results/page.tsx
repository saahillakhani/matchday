import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultGw, getFixtures } from "@/lib/fpl";
import { filterByTeams, sortFixtures } from "@/lib/match-key";
import { aggregate, scorePick, type Outcome } from "@/lib/scoring";
import { ResultsView } from "./form";

export default async function ResultsPage({
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
  if (!user) redirect("/sign-in");

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, selected_teams, current_gw")
    .eq("id", leagueId)
    .single();

  if (!league) redirect("/");

  // Honour ?gw=; otherwise default to the in-progress gameweek (or next
  // one between GWs), matching the Predict tab. Falls back to the
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

  const [picksRes, resultsRes] = await Promise.all([
    supabase
      .from("predictions")
      .select("match_index, home_score, away_score")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .eq("gw", gw),
    supabase
      .from("results")
      .select("match_index, home_score, away_score")
      .eq("league_id", leagueId)
      .eq("gw", gw),
  ]);

  const myPicks = new Map<number, { home: number; away: number }>();
  for (const row of picksRes.data ?? []) {
    if (row.home_score !== null && row.away_score !== null) {
      myPicks.set(row.match_index, {
        home: row.home_score,
        away: row.away_score,
      });
    }
  }
  const actuals = new Map<number, { home: number; away: number }>();
  for (const row of resultsRes.data ?? []) {
    if (row.home_score !== null && row.away_score !== null) {
      actuals.set(row.match_index, {
        home: row.home_score,
        away: row.away_score,
      });
    }
  }

  const matches = sorted.map((f) => {
    const mine = myPicks.get(f.matchIndex) ?? null;
    const actual = actuals.get(f.matchIndex) ?? null;
    const outcome = scorePick(mine, actual);
    return {
      matchIndex: f.matchIndex,
      home: f.homeTeam,
      away: f.awayTeam,
      kickoff: f.kickoffTime,
      mine,
      actual,
      label: outcome.label,
      points: outcome.points,
      bonus: outcome.bonus,
    };
  });

  const outcomes: Outcome[] = matches.map((m) => ({
    points: m.points as 0 | 1 | 3,
    bonus: m.bonus as 0 | 1,
    label: m.label,
  }));
  const summary = aggregate(outcomes);

  const remaining = matches.filter((m) => !m.actual).length;
  const isFuture = gw > league.current_gw;

  return (
    <ResultsView
      leagueId={league.id}
      leagueName={league.name}
      currentGw={league.current_gw}
      selectedGw={gw}
      matches={matches}
      summary={summary}
      remaining={remaining}
      isFuture={isFuture}
    />
  );
}
