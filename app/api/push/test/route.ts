import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUsers } from "@/lib/push";

/** Sends a push to the signed-in user's own devices — used by the
 *  "Send a test notification" control in Settings. */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await sendPushToUsers([user.id], {
    title: "Notifications are on",
    body: "This is a test — you're all set for The Matchday.",
    url: "/",
  });

  return NextResponse.json({ ok: true });
}
