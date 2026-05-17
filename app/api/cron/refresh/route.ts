import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { liveFixtureSource, syncLeague } from "@/lib/cron-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Per-user throttle. In-memory only — on Vercel that means per-instance,
// which is good enough at our scale (Hobby has few concurrent instances
// and the worst case is "user can refresh once per instance per cooldown").
const COOLDOWN_MS = 30_000;
const lastRefreshByUser = new Map<string, number>();

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const leagueId = searchParams.get("leagueId");
  if (!leagueId) {
    return NextResponse.json({ error: "Missing leagueId" }, { status: 400 });
  }

  // Verify membership via the user's client — RLS rejects non-members.
  const { data: league } = await supabase
    .from("leagues")
    .select("id, current_gw, selected_teams, base_order, locked")
    .eq("id", leagueId)
    .single();

  if (!league) {
    return NextResponse.json(
      { error: "Not a member of this league" },
      { status: 403 },
    );
  }

  // Throttle. The map is in-process state so this is approximate — fine
  // for our scale.
  const now = Date.now();
  const last = lastRefreshByUser.get(user.id);
  if (last && now - last < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: `Hold on — try again in ${waitSec}s.` },
      { status: 429 },
    );
  }
  lastRefreshByUser.set(user.id, now);

  // Service client for the actual writes (results table is service-only).
  const service = createServiceClient();
  try {
    const report = await syncLeague(
      service,
      league as Parameters<typeof syncLeague>[1],
      liveFixtureSource,
      new Date(),
    );
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[cron/refresh] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
