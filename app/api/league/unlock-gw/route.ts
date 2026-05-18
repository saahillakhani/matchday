import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Admin action: un-submit every player for a gameweek so they can edit
// and re-submit. Scores (predictions rows) are left untouched — this
// only deletes the submission records. Only the league creator may call
// it. The RLS delete policy on `submissions` enforces the same rule, so
// this is gated twice.

type Payload = { leagueId?: unknown; gw?: unknown };

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

  if (!leagueId || !Number.isInteger(gw)) {
    return NextResponse.json(
      { error: "Missing leagueId or gw" },
      { status: 400 },
    );
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("id, created_by")
    .eq("id", leagueId)
    .single();

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }
  if (league.created_by !== user.id) {
    return NextResponse.json(
      { error: "Only the league creator can unlock a gameweek." },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("submissions")
    .delete()
    .eq("league_id", leagueId)
    .eq("gw", gw);

  if (error) {
    console.error("[league/unlock-gw] delete failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
