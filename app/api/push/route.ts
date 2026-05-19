import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubscribeBody = {
  subscription?: {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
};

/** Register the current device for push. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as SubscribeBody;
  const sub = body.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid subscription" },
      { status: 400 },
    );
  }

  // Clear any previous owner of this endpoint, then claim it. RLS scopes
  // the delete to the current user, so this only re-homes our own rows.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  const userAgent = request.headers.get("user-agent");
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
  });

  if (error) {
    // 23505 = unique violation = already registered. Treat as success.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true });
    }
    console.error("[api/push] insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Remove the current device from push. */
export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    endpoint?: unknown;
  };
  const endpoint = body.endpoint;
  if (typeof endpoint !== "string") {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
