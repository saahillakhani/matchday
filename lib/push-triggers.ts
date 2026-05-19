import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { rotationForGw } from "@/lib/rotation";
import { sendPushToUsers } from "@/lib/push";
import type { SyncReport } from "@/lib/cron-sync";

/**
 * Notification triggers. Three moments matter:
 *   1. A player submits → the next player in the rotation is on the clock.
 *   2. A gameweek locks (first kickoff) → the whole league is told.
 *   3. A gameweek finishes → the league is told the table updated, and
 *      the new gameweek's first picker is told it's their turn.
 *
 * Every send is wrapped so a push failure can never break the submit
 * flow or the cron run.
 */

type Supa = ReturnType<typeof createServiceClient>;

async function memberIds(supabase: Supa, leagueId: string): Promise<string[]> {
  const { data } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);
  return (data ?? [])
    .map((m) => m.user_id)
    .filter((id): id is string => id !== null);
}

async function leagueName(supabase: Supa, leagueId: string): Promise<string> {
  const { data } = await supabase
    .from("leagues")
    .select("name")
    .eq("id", leagueId)
    .single();
  return data?.name ?? "Your league";
}

/**
 * Called after a player submits. If that submission cleared the way for
 * the next player in the rotation — i.e. the submitter was the one
 * everyone was waiting on — that next player gets a "your turn" nudge.
 * If the player submitted out of turn, nothing moves and nobody is told.
 */
export async function notifyNextToPredict(
  leagueId: string,
  gw: number,
  justSubmitted: string,
): Promise<void> {
  try {
    const supabase = createServiceClient();

    const { data: league } = await supabase
      .from("leagues")
      .select("base_order")
      .eq("id", leagueId)
      .single();
    if (!league || league.base_order.length === 0) return;

    const { data: subRows } = await supabase
      .from("submissions")
      .select("user_id")
      .eq("league_id", leagueId)
      .eq("gw", gw);
    const submitted = new Set(
      (subRows ?? [])
        .map((r) => r.user_id)
        .filter((id): id is string => !!id),
    );

    const rotation = rotationForGw(league.base_order, gw);

    // Who was on the clock *before* this submission landed?
    const before = new Set(submitted);
    before.delete(justSubmitted);
    const onClockBefore = rotation.find((u) => !before.has(u));

    // The submitter wasn't holding anyone up — clock hasn't moved.
    if (onClockBefore !== justSubmitted) return;

    const onClockAfter = rotation.find((u) => !submitted.has(u));
    if (!onClockAfter || onClockAfter === justSubmitted) return;

    await sendPushToUsers([onClockAfter], {
      title: "You're up",
      body: `Everyone above you has predicted GW ${gw}. Get your scores in.`,
      url: `/predict?leagueId=${leagueId}`,
    });
  } catch (err) {
    console.error("[push] notifyNextToPredict failed:", err);
  }
}

/**
 * Called by the cron after a sync run. Fires the league-wide
 * notifications for any gameweek that just locked or just finished.
 */
export async function dispatchSyncNotifications(
  reports: SyncReport[],
): Promise<void> {
  const supabase = createServiceClient();

  for (const report of reports) {
    try {
      if (report.action === "locked") {
        const [members, name] = await Promise.all([
          memberIds(supabase, report.leagueId),
          leagueName(supabase, report.leagueId),
        ]);
        await sendPushToUsers(members, {
          title: `GW ${report.fromGw} kicks off`,
          body: `${name}: predictions are locked. Good luck.`,
          url: `/table?leagueId=${report.leagueId}`,
        });
      } else if (report.action === "advanced-all-finished") {
        const [members, name] = await Promise.all([
          memberIds(supabase, report.leagueId),
          leagueName(supabase, report.leagueId),
        ]);
        await sendPushToUsers(members, {
          title: `GW ${report.fromGw} wrapped`,
          body: `${name}: every score is in and the table's updated.`,
          url: `/table?leagueId=${report.leagueId}`,
        });

        // The next gameweek is now open — tell its first picker.
        const nextGw = report.fromGw + 1;
        const { data: league } = await supabase
          .from("leagues")
          .select("base_order")
          .eq("id", report.leagueId)
          .single();
        const starter =
          league && league.base_order.length > 0
            ? rotationForGw(league.base_order, nextGw)[0]
            : undefined;
        if (starter) {
          await sendPushToUsers([starter], {
            title: "You're up",
            body: `GW ${nextGw} is open — you're on the clock. Get your predictions in.`,
            url: `/predict?leagueId=${report.leagueId}`,
          });
        }
      }
    } catch (err) {
      console.error(
        "[push] dispatchSyncNotifications failed for",
        report.leagueId,
        err,
      );
    }
  }
}
