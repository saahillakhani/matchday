"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type State =
  | { kind: "idle" }
  | { kind: "joining" }
  | { kind: "error"; message: string };

export function JoinConfirm({
  code,
  leagueName,
}: {
  code: string;
  leagueName: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onJoin() {
    setState({ kind: "joining" });
    const res = await fetch("/api/league/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setState({
        kind: "error",
        message: error ?? "Could not join the league",
      });
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-8 py-16">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
        Joining
      </p>
      <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight mt-3">
        {leagueName}
      </h1>
      <p className="text-muted-foreground italic mt-4 max-w-md">
        Ready when you are.
      </p>

      <Button
        onClick={onJoin}
        disabled={state.kind === "joining"}
        className="mt-10 h-12 px-10"
      >
        {state.kind === "joining" ? "Joining…" : "Join league"}
      </Button>

      {state.kind === "error" && (
        <p className="text-sm text-destructive mt-4">{state.message}</p>
      )}
    </main>
  );
}
