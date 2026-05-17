import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeStandings,
  type Member,
  type RawPick,
  type RawResult,
} from "@/lib/standings";
import { fetchAllPredictions } from "@/lib/fetch-all-predictions";
import { TableView } from "./form";

export default async function TablePage({
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
    .select("id, name, current_gw")
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
  const rowByUser = new Map(rows.map((r) => [r.userId, r]));

  const allGws = Array.from(new Set(results.map((r) => r.gw))).sort(
    (a, b) => b - a,
  );
  const latestGw = allGws[0] ?? null;

  const tableRows = rankedOrder.map((userId, idx) => {
    const r = rowByUser.get(userId)!;
    const latest = latestGw
      ? r.perGw.find((g) => g.gw === latestGw)
      : undefined;
    return {
      rank: idx + 1,
      userId,
      displayName: r.displayName,
      isMe: userId === user.id,
      gw: latest?.points ?? 0,
      bn: latest?.bonus ?? 0,
      bns: r.totals.bonus,
      pts: r.totals.points,
    };
  });

  // For Form Grid: per-player bars across all played GWs.
  const players = rankedOrder.map((userId) => {
    const r = rowByUser.get(userId)!;
    const max = Math.max(0, ...r.perGw.map((g) => g.points));
    return {
      userId,
      displayName: r.displayName,
      isMe: userId === user.id,
      total: r.totals.points,
      perGw: r.perGw.map((g) => ({
        gw: g.gw,
        points: g.points,
        isBest: g.points > 0 && g.points === max,
        isLive: g.gw === league.current_gw,
      })),
    };
  });

  return (
    <TableView
      leagueId={league.id}
      leagueName={league.name}
      tableRows={tableRows}
      afterGw={latestGw}
      players={players}
    />
  );
}
