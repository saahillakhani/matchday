import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFixtures } from "@/lib/fpl";
import { filterByTeams, sortFixtures } from "@/lib/match-key";
import { aggregate, scorePick, type Outcome } from "@/lib/scoring";

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
    return NextResponse.json({ error: "Missing leagueId" }, { status: 400 });
  }
  if (!Number.isInteger(gw) || gw < 1 || gw > 38) {
    return NextResponse.json(
      { error: "Invalid gw (must be 1–38)" },
      { status: 400 },
    );
  }

  // RLS gates this; non-members get nothing.
  const { data: league } = await supabase
    .from("leagues")
    .select("id, selected_teams, current_gw")
    .eq("id", leagueId)
    .single();

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
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

  return NextResponse.json({
    summary,
    matches,
    remaining,
    isFuture: gw > league.current_gw,
  });
}
