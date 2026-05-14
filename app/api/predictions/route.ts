import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFixtures } from "@/lib/fpl";
import { filterByTeams, sortFixtures } from "@/lib/match-key";

type Pick = { matchIndex: number; home: number; away: number };

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
  if (picks.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // RLS gates this: non-members and non-creators get nothing.
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

  // Compute the GW's fixtures from the same source the cron and the
  // fixtures route use, so match_index numbers line up across all writes.
  const fplFixtures = await getFixtures(gw);
  const relevant = filterByTeams(fplFixtures, league.selected_teams);
  const sorted = sortFixtures(relevant);

  if (sorted.length === 0) {
    return NextResponse.json(
      { error: "No fixtures involving your teams in this gameweek" },
      { status: 400 },
    );
  }

  // Hard gate: once the first kickoff passes, no edits — even if the cron
  // hasn't yet flipped the leagues.locked flag.
  const firstKickoff = sorted[0].kickoffTime;
  if (firstKickoff && new Date(firstKickoff) <= new Date()) {
    return NextResponse.json(
      { error: "This gameweek has kicked off — picks are locked" },
      { status: 403 },
    );
  }

  // Validate every match_index is in range; reject the whole batch on
  // mismatch so we never write a partial mis-aligned set.
  const maxIndex = sorted.length - 1;
  for (const pick of picks) {
    if (pick.matchIndex < 0 || pick.matchIndex > maxIndex) {
      return NextResponse.json(
        {
          error: `matchIndex ${pick.matchIndex} out of range (0–${maxIndex})`,
        },
        { status: 400 },
      );
    }
  }

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
    console.error("[predictions] upsert failed:", upsertError);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function parsePicks(input: unknown): Pick[] | null {
  if (!Array.isArray(input)) return null;
  const out: Pick[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const matchIndex = r.matchIndex;
    const home = r.home;
    const away = r.away;
    if (
      !Number.isInteger(matchIndex) ||
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      (home as number) < 0 ||
      (away as number) < 0 ||
      (home as number) > 20 ||
      (away as number) > 20
    ) {
      return null;
    }
    out.push({
      matchIndex: matchIndex as number,
      home: home as number,
      away: away as number,
    });
  }
  return out;
}
