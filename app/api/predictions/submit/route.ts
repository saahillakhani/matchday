import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFixtures } from "@/lib/fpl";
import { filterByTeams, sortFixtures } from "@/lib/match-key";
import { parsePicks } from "@/lib/parse-picks";
import { notifyNextToPredict } from "@/lib/push-triggers";

type Payload = {
  leagueId?: unknown;
  gw?: unknown;
  picks?: unknown;
};

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Payload;
  const leagueId = typeof body.leagueId === "string" ? body.leagueId : "";
  const gw = typeof body.gw === "number" ? body.gw : NaN;

  if (!leagueId) {
    return NextResponse.json({ error: "Missing leagueId" }, { status: 400 });
  }
  if (!Number.isInteger(gw) || gw < 1 || gw > 38) {
    return NextResponse.json(
      { error: "Invalid gw (must be 1–38)" },
      { status: 400 },
    );
  }

  const picks = parsePicks(body.picks);
  if (!picks) {
    return NextResponse.json(
      { error: "Invalid picks payload" },
      { status: 400 },
    );
  }

  // RLS gates this — non-members get nothing.
  const { data: league } = await supabase
    .from("leagues")
    .select("id, selected_teams")
    .eq("id", leagueId)
    .single();

  if (!league) {
    return NextResponse.json(
      { error: "League not found or you are not a member" },
      { status: 404 },
    );
  }

  // Already submitted? Locked.
  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .eq("gw", gw)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You've already submitted this gameweek." },
      { status: 403 },
    );
  }

  // Same fixture computation as everywhere else.
  const fplFixtures = await getFixtures(gw);
  const relevant = filterByTeams(fplFixtures, league.selected_teams);
  const sorted = sortFixtures(relevant);

  if (sorted.length === 0) {
    return NextResponse.json(
      { error: "No fixtures involving your teams in this gameweek" },
      { status: 400 },
    );
  }

  // No edits after kickoff.
  const firstKickoff = sorted[0].kickoffTime;
  if (firstKickoff && new Date(firstKickoff) <= new Date()) {
    return NextResponse.json(
      { error: "This gameweek has kicked off — picks are locked" },
      { status: 403 },
    );
  }

  // Submit requires a COMPLETE set: one valid pick per fixture.
  const expectedIndexes = new Set(sorted.map((f) => f.matchIndex));
  const providedIndexes = new Set(picks.map((p) => p.matchIndex));
  if (
    picks.length !== sorted.length ||
    [...expectedIndexes].some((i) => !providedIndexes.has(i))
  ) {
    return NextResponse.json(
      {
        error: `Fill in all ${sorted.length} scores before submitting.`,
      },
      { status: 400 },
    );
  }

  // Persist the picks, then record the submission.
  const rows = picks.map((p) => ({
    league_id: leagueId,
    user_id: user.id,
    gw,
    match_index: p.matchIndex,
    home_score: p.home,
    away_score: p.away,
  }));

  const { error: upsertError } = await supabase
    .from("predictions")
    .upsert(rows, { onConflict: "league_id,user_id,gw,match_index" });

  if (upsertError) {
    console.error("[predictions/submit] upsert failed:", upsertError);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { error: submitError } = await supabase
    .from("submissions")
    .insert({ league_id: leagueId, user_id: user.id, gw });

  if (submitError) {
    // 23505 = unique violation = a concurrent submit already landed.
    if ((submitError as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true });
    }
    console.error("[predictions/submit] submission insert failed:", submitError);
    return NextResponse.json({ error: submitError.message }, { status: 500 });
  }

  // Nudge the next player if this submission moved the rotation on.
  await notifyNextToPredict(leagueId, gw, user.id);

  return NextResponse.json({ ok: true });
}
