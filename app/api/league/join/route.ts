import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getLeagueByCode } from "@/lib/league-lookup";
import { getFixtures } from "@/lib/fpl";
import { filterByTeams, sortFixtures } from "@/lib/match-key";
import { MAX_LEAGUE_SIZE } from "@/lib/constants";

type JoinPayload = { code?: unknown };

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as JoinPayload;
  const code =
    typeof body.code === "string" ? body.code.trim().toLowerCase() : "";

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const { league, error: lookupError } = await getLeagueByCode(supabase, code);
  if (lookupError) {
    console.error("[league/join] lookup failed:", lookupError);
    return NextResponse.json({ error: lookupError }, { status: 500 });
  }
  if (!league) {
    return NextResponse.json(
      { error: "No league with that code" },
      { status: 404 },
    );
  }
  if (league.locked) {
    return NextResponse.json({ error: "League is locked" }, { status: 403 });
  }

  // Service-role client for the next few reads (membership + league row).
  // RLS would block these for someone not yet in the league.
  const service = createServiceClient();

  // Defence against the daily-cron lag: even if league.locked is still
  // false, reject the join if the current GW has already kicked off. The
  // cron will eventually flip the flag, but we shouldn't accept new
  // members between kickoff and the next cron run.
  const { data: leagueRow } = await service
    .from("leagues")
    .select("current_gw, selected_teams")
    .eq("id", league.id)
    .single();

  if (leagueRow) {
    const fplFixtures = await getFixtures(leagueRow.current_gw);
    const relevant = filterByTeams(fplFixtures, leagueRow.selected_teams);
    const sorted = sortFixtures(relevant);
    const firstKickoff = sorted[0]?.kickoffTime ?? null;
    if (firstKickoff && new Date(firstKickoff) <= new Date()) {
      return NextResponse.json(
        { error: "League is locked" },
        { status: 403 },
      );
    }
  }

  // Enforce the member cap. RLS would block this count for a non-member, so
  // we use the service-role client (server-only) just for this read. If the
  // caller is already a member the unique constraint short-circuits below.
  const { count: memberCount, error: countError } = await service
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", league.id);

  if (countError) {
    console.error("[league/join] count failed:", countError);
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((memberCount ?? 0) >= MAX_LEAGUE_SIZE) {
    // Only reject if the caller isn't already in. Already-members get the
    // idempotent success path via the unique-violation handler below.
    const { data: existing } = await service
      .from("league_members")
      .select("user_id")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json(
        { error: `League is full (max ${MAX_LEAGUE_SIZE} members)` },
        { status: 403 },
      );
    }
  }

  const { error: memberError } = await supabase
    .from("league_members")
    .insert({ league_id: league.id, user_id: user.id });

  if (memberError) {
    // 23505 = unique_violation = already a member; idempotent join.
    if ((memberError as { code?: string }).code === "23505") {
      return NextResponse.json({ league });
    }
    console.error("[league/join] member insert failed:", memberError);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ league });
}
