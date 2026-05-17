import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeStandings,
  type Member,
  type RawPick,
  type RawResult,
} from "@/lib/standings";
import { fetchAllPredictions } from "@/lib/fetch-all-predictions";
import { YouView } from "./form";

export default async function YouPage({
  searchParams,
}: {
  searchParams: { leagueId?: string };
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
    .select("id, name, code, current_gw")
    .eq("id", leagueId)
    .single();
  if (!league) redirect("/");

  type MemberRow = {
    user_id: string | null;
    profiles: { display_name: string } | null;
  };

  const [membersRes, picksData, resultsRes] = await Promise.all([
    supabase
      .from("league_members")
      .select("user_id, profiles(display_name)")
      .eq("league_id", leagueId),
    fetchAllPredictions(supabase, leagueId),
    supabase
      .from("results")
      .select("gw, match_index, home_score, away_score")
      .eq("league_id", leagueId),
  ]);
  const picksRes = { data: picksData };

  const members: Member[] = ((membersRes.data ?? []) as MemberRow[])
    .filter((m): m is MemberRow & { user_id: string } => !!m.user_id)
    .map((m) => ({
      userId: m.user_id,
      displayName: m.profiles?.display_name ?? "—",
    }));

  const picks: RawPick[] = (picksRes.data ?? [])
    .filter(
      (p) => p.user_id && p.home_score !== null && p.away_score !== null,
    )
    .map((p) => ({
      userId: p.user_id!,
      gw: p.gw,
      matchIndex: p.match_index,
      home: p.home_score!,
      away: p.away_score!,
    }));

  const results: RawResult[] = (resultsRes.data ?? [])
    .filter((r) => r.home_score !== null && r.away_score !== null)
    .map((r) => ({
      gw: r.gw,
      matchIndex: r.match_index,
      home: r.home_score!,
      away: r.away_score!,
    }));

  const { rows, rankedOrder } = computeStandings({ members, picks, results });
  const mine = rows.find((r) => r.userId === user.id);
  if (!mine) redirect("/");

  const position = rankedOrder.indexOf(user.id) + 1;
  const allGws = Array.from(new Set(results.map((r) => r.gw))).sort(
    (a, b) => b - a,
  );
  const latestGw = allGws[0] ?? null;
  const latest = latestGw
    ? mine.perGw.find((g) => g.gw === latestGw)
    : undefined;

  const maxPerGw = Math.max(0, ...mine.perGw.map((g) => g.points));
  const formBars = mine.perGw.map((g) => ({
    gw: g.gw,
    points: g.points,
    isBest: g.points > 0 && g.points === maxPerGw,
    isLive: g.gw === league.current_gw,
  }));

  return (
    <YouView
      leagueId={league.id}
      leagueName={league.name}
      leagueCode={league.code}
      displayName={mine.displayName}
      points={mine.totals.points}
      position={position}
      totalMembers={rows.length}
      weekPoints={latest?.points ?? 0}
      exacts={mine.totals.exacts}
      bonusTotal={mine.totals.bonus}
      formBars={formBars}
    />
  );
}
