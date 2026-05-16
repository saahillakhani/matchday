import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  abbreviateName,
  isStarter,
  rotationForGw,
  visibleUserIds,
} from "@/lib/rotation";

type RotationEntry = {
  userId: string;
  displayName: string;
  abbr: string;
  isStarter: boolean;
};

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

  const { data: league } = await supabase
    .from("leagues")
    .select("id, base_order, locked, current_gw")
    .eq("id", leagueId)
    .single();

  if (!league) {
    return NextResponse.json(
      { error: "League not found" },
      { status: 404 },
    );
  }

  // Pull members + names so we can build the rotation entries.
  const { data: members } = await supabase
    .from("league_members")
    .select("user_id, profiles(display_name)")
    .eq("league_id", leagueId);

  type MemberRow = {
    user_id: string | null;
    profiles: { display_name: string } | null;
  };
  const memberRows = (members ?? []) as MemberRow[];

  const nameByUserId = new Map<string, string>();
  for (const m of memberRows) {
    if (m.user_id) {
      nameByUserId.set(m.user_id, m.profiles?.display_name ?? "—");
    }
  }

  const baseOrder = (league.base_order ?? []) as string[];
  const rotationIds = rotationForGw(baseOrder, gw);

  const rotation: RotationEntry[] = rotationIds.map((uid) => ({
    userId: uid,
    displayName: nameByUserId.get(uid) ?? "—",
    abbr: abbreviateName(nameByUserId.get(uid) ?? "—"),
    isStarter: isStarter(rotationIds, uid),
  }));

  // Determine visibility. Past or locked GWs reveal everyone's picks; the
  // current open GW reveals only users above me in the rotation (plus me).
  const isPastGw = gw < league.current_gw;
  const locked = league.locked || isPastGw;

  let visibleIds: string[];
  if (locked) {
    visibleIds = Array.from(nameByUserId.keys());
  } else {
    visibleIds = [...visibleUserIds(rotationIds, user.id), user.id];
  }

  // If the league hasn't locked yet, base_order is empty and the rotation
  // is []. We still let the caller see their own picks in that case.
  if (rotationIds.length === 0 && !visibleIds.includes(user.id)) {
    visibleIds.push(user.id);
  }

  const { data: predictions } =
    visibleIds.length === 0
      ? { data: [] }
      : await supabase
          .from("predictions")
          .select("user_id, match_index, home_score, away_score")
          .eq("league_id", leagueId)
          .eq("gw", gw)
          .in("user_id", visibleIds);

  const picks: Record<
    string,
    Record<number, { home: number; away: number }>
  > = {};
  for (const row of predictions ?? []) {
    if (row.home_score === null || row.away_score === null || !row.user_id)
      continue;
    if (!picks[row.user_id]) picks[row.user_id] = {};
    picks[row.user_id][row.match_index] = {
      home: row.home_score,
      away: row.away_score,
    };
  }

  return NextResponse.json({
    rotation,
    picks,
    locked,
  });
}
