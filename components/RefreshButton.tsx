"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export function RefreshButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onClick() {
    if (state.kind === "loading") return;
    setState({ kind: "loading" });
    const res = await fetch(
      `/api/cron/refresh?leagueId=${encodeURIComponent(leagueId)}`,
      { method: "POST" },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setState({ kind: "error", message: body.error ?? "Could not refresh" });
      // Clear error after a moment so it doesn't linger.
      setTimeout(() => setState({ kind: "idle" }), 3000);
      return;
    }
    setState({ kind: "idle" });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={state.kind === "loading"}
        aria-label="Refresh scores from FPL"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
      >
        <RefreshCw
          className={[
            "w-3.5 h-3.5",
            state.kind === "loading" ? "animate-spin" : "",
          ].join(" ")}
        />
        {state.kind === "loading" ? "Refreshing" : "Refresh"}
      </button>
      {state.kind === "error" && (
        <p className="text-[10px] text-destructive">{state.message}</p>
      )}
    </div>
  );
}
