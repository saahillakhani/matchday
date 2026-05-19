import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncAllLeagues } from "@/lib/cron-sync";
import { dispatchSyncNotifications } from "@/lib/push-triggers";

// Vercel cron hits this on the schedule defined in vercel.json. The
// platform injects an Authorization: Bearer ${CRON_SECRET} header on
// cron-originated requests when CRON_SECRET is set as an env var, so we
// gate on that. Manual hits from anywhere else are rejected.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    const reports = await syncAllLeagues(supabase);
    await dispatchSyncNotifications(reports);
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      reports,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[cron/sync] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
