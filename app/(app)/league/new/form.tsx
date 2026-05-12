"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { teamCode, teamColor } from "@/lib/teams";

const MAX_TEAMS = 6;

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export function NewLeagueForm({ teams }: { teams: string[] }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleTeam(team: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(team)) {
        next.delete(team);
      } else if (next.size < MAX_TEAMS) {
        next.add(team);
      }
      return next;
    });
  }

  const canSubmit =
    name.trim().length > 0 &&
    selected.size === MAX_TEAMS &&
    state.kind !== "submitting";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setState({ kind: "submitting" });

    const res = await fetch("/api/league/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        selectedTeams: Array.from(selected),
      }),
    });

    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setState({ kind: "error", message: error ?? "Could not create league" });
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="space-y-2">
        <label
          htmlFor="leagueName"
          className="text-xs uppercase tracking-widest text-muted-foreground"
        >
          League name
        </label>
        <Input
          id="leagueName"
          required
          maxLength={40}
          placeholder="e.g. The Friends Five"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">
            Teams
          </label>
          <span className="font-mono text-sm text-muted-foreground">
            {selected.size} / {MAX_TEAMS}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {teams.map((team) => {
            const isSelected = selected.has(team);
            const disabled = !isSelected && selected.size >= MAX_TEAMS;
            return (
              <button
                key={team}
                type="button"
                onClick={() => toggleTeam(team)}
                disabled={disabled}
                aria-pressed={isSelected}
                className={[
                  "flex items-center gap-2 px-3 py-2 rounded-card border text-left text-sm transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white border-border hover:border-foreground",
                  disabled ? "opacity-40 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-mono font-semibold text-white shrink-0"
                  style={{ backgroundColor: teamColor(team) }}
                >
                  {teamCode(team)}
                </span>
                <span className="truncate">{team}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Button type="submit" disabled={!canSubmit} className="w-full h-12">
          {state.kind === "submitting" ? "Creating…" : "Create league"}
        </Button>
        {state.kind === "error" && (
          <p className="text-sm text-destructive text-center">{state.message}</p>
        )}
      </div>
    </form>
  );
}
