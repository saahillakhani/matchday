"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Web push UI — a toggle for the Settings screen and a one-tap prompt
 * card for the home screen. The actual OS permission can't be defaulted
 * on (the browser forces an explicit "Allow"), so the prompt is the
 * closest thing: open the app, tap once, done.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISS_KEY = "md-notif-prompt-dismissed";

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type EnableResult = { ok: true } | { ok: false; reason: "denied" | "error" };

async function enablePush(): Promise<EnableResult> {
  if (!pushSupported() || !VAPID_PUBLIC_KEY) {
    return { ok: false, reason: "error" };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: "error" };
  } catch (err) {
    console.error("[push] enable failed:", err);
    return { ok: false, reason: "error" };
  }
}

async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch (err) {
    console.error("[push] disable failed:", err);
  }
}

async function hasActiveSubscription(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}

type ToggleState =
  | "loading"
  | "unsupported-install"
  | "unsupported-browser"
  | "off"
  | "on"
  | "denied"
  | "working";

const SUBTITLES: Record<ToggleState, string> = {
  loading: "Checking…",
  "unsupported-install":
    "Add The Matchday to your home screen to turn these on",
  "unsupported-browser": "Not supported on this browser",
  off: "Off",
  on: "On",
  denied: "Blocked — turn this on in your device settings",
  working: "Just a sec…",
};

/** The Notifications row for the Settings screen. */
export function NotificationToggle() {
  const [state, setState] = useState<ToggleState>("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!pushSupported() || !VAPID_PUBLIC_KEY) {
        if (active) {
          setState(
            isStandalone()
              ? "unsupported-browser"
              : "unsupported-install",
          );
        }
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setState("denied");
        return;
      }
      const subscribed = await hasActiveSubscription();
      if (active) setState(subscribed ? "on" : "off");
    })();
    return () => {
      active = false;
    };
  }, []);

  async function toggle() {
    if (state === "off") {
      setState("working");
      const result = await enablePush();
      setState(
        result.ok
          ? "on"
          : result.reason === "denied"
            ? "denied"
            : "off",
      );
    } else if (state === "on") {
      setState("working");
      await disablePush();
      setState("off");
    }
  }

  const showSwitch = state === "on" || state === "off" || state === "working";

  return (
    <div className="flex items-center justify-between border-t border-border py-4">
      <div className="pr-4">
        <p className="text-sm font-medium">Notifications</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {SUBTITLES[state]}
        </p>
      </div>
      {showSwitch && (
        <button
          type="button"
          role="switch"
          aria-checked={state === "on"}
          disabled={state === "working"}
          onClick={toggle}
          className={[
            "inline-flex items-center w-11 h-6 rounded-full px-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            state === "on"
              ? "justify-end bg-foreground"
              : "justify-start bg-muted",
            state === "working"
              ? "opacity-40 cursor-not-allowed"
              : "cursor-pointer",
          ].join(" ")}
        >
          <span
            aria-hidden
            className="block w-5 h-5 rounded-full bg-white shadow-sm"
          />
        </button>
      )}
    </div>
  );
}

/** Proactive "turn on notifications" card for the home screen. */
export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!pushSupported() || !VAPID_PUBLIC_KEY) return;
    // "default" = never asked. "granted"/"denied" = decided, nothing to do.
    if (Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage unavailable — still fine to show the prompt.
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  async function enable() {
    setWorking(true);
    const result = await enablePush();
    setWorking(false);
    // Either way the question's been answered — don't keep nagging.
    if (result.ok || result.reason === "denied") setVisible(false);
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <div className="w-full border border-border rounded-card bg-white p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Turn on notifications</p>
          <p className="text-xs text-muted-foreground mt-1">
            Get a nudge when it&apos;s your turn to predict, when a
            gameweek kicks off, and when the table updates.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <Button
        onClick={enable}
        disabled={working}
        className="w-full mt-3"
      >
        {working ? "Enabling…" : "Enable notifications"}
      </Button>
    </div>
  );
}
