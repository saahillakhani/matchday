import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data, error } = await supabase
    .from("predictions")
    .select("match_index, home_score, away_score")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .eq("gw", gw)
    .order("match_index", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const picks = (data ?? []).map((row) => ({
    matchIndex: row.match_index,
    home: row.home_score,
    away: row.away_score,
  }));

  return NextResponse.json({ picks });
}
