import "server-only";
import * as webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Web push sender. Looks up every device a user has registered and
 * delivers the payload; stale subscriptions (the browser told us the
 * endpoint is gone) are pruned so they don't pile up.
 */

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    "https://thematchday.co.uk",
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  const targets = [...new Set(userIds)];
  if (targets.length === 0) return;
  if (!ensureConfigured()) {
    console.warn("[push] VAPID keys not set — skipping send");
    return;
  }

  const supabase = createServiceClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", targets);

  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
        );
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // 404 / 410 — the push service has dropped this endpoint.
        if (code === 404 || code === 410) {
          stale.push(s.id);
        } else {
          console.error(
            "[push] send failed:",
            code,
            (err as Error).message,
          );
        }
      }
    }),
  );

  if (stale.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", stale);
  }
}
