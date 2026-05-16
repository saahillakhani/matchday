"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GwSwitcher } from "@/components/GwSwitcher";
import { MatchRow } from "@/components/MatchRow";

type Fixture = {
  matchIndex: number;
  home: string;
  away: string;
  kickoff: string | null;
};

type Pick = { home: number | null; away: number | null };

type Props = {
  leagueId: string;
  leagueName: string;
  currentGw: number;
  selectedGw: number;
  locked: boolean;
  firstKickoff: string | null;
  fixtures: Fixture[];
  existingPicks: Record<number, { home: number; away: number }>;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function PredictForm(props: Props) {
  const router = useRouter();
  const [picks, setPicks] = useState<Record<number, Pick>>(() =>
    initialPicks(props.fixtures, props.existingPicks),
  );
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  // Reset local state when the user switches to a different GW.
  useEffect(() => {
    setPicks(initialPicks(props.fixtures, props.existingPicks));
    setState({ kind: "idle" });
  }, [props.selectedGw, props.fixtures, props.existingPicks]);

  function gwChange(gw: number) {
    const params = new URLSearchParams({
      leagueId: props.leagueId,
      gw: String(gw),
    });
    router.push(`/predict?${params.toString()}`);
  }

  function handlePickChange(
    matchIndex: number,
    home: number | null,
    away: number | null,
  ) {
    setPicks((prev) => ({ ...prev, [matchIndex]: { home, away } }));
    if (state.kind !== "idle") setState({ kind: "idle" });
  }

  async function onSave() {
    const toSave = Object.entries(picks)
      .filter(([, p]) => p.home !== null && p.away !== null)
      .map(([idx, p]) => ({
        matchIndex: Number.parseInt(idx, 10),
        home: p.home!,
        away: p.away!,
      }));

    if (toSave.length === 0) {
      setState({
        kind: "error",
        message: "Add at least one pick before saving.",
      });
      return;
    }

    setState({ kind: "saving" });
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagueId: props.leagueId,
        gw: props.selectedGw,
        picks: toSave,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setState({
        kind: "error",
        message: body.error ?? "Could not save picks",
      });
      return;
    }
    setState({ kind: "saved" });
    router.refresh();
  }

  const filledCount = Object.values(picks).filter(
    (p) => p.home !== null && p.away !== null,
  ).length;
  const total = props.fixtures.length;

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:py-12">
      <div className="max-w-xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3 h-3" />
          All leagues
        </Link>

        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-6">
          {props.leagueName}
        </p>
        <h1 className="font-serif text-5xl font-semibold leading-tight mt-2">
          Predict
        </h1>
        <p className="text-sm text-muted-foreground italic mt-3">
          Lock in your picks any time before kickoff. You&apos;ll see picks
          above you in rotation as they come in.
        </p>

        <div className="mt-6">
          <GwSwitcher
            currentGw={props.currentGw}
            selectedGw={props.selectedGw}
            onChange={gwChange}
          />
        </div>

        {total === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-muted-foreground italic">
              No fixtures for your teams in GW {props.selectedGw}.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center justify-between border border-dashed border-border rounded-card px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              <span>
                {filledCount} / {total} scores in
              </span>
              {props.firstKickoff && (
                <span>
                  {props.locked
                    ? "locked"
                    : formatStartsAt(props.firstKickoff)}
                </span>
              )}
            </div>

            <div className="mt-2">
              {props.fixtures.map((f) => (
                <MatchRow
                  key={f.matchIndex}
                  home={f.home}
                  away={f.away}
                  kickoff={f.kickoff}
                  predictedHome={picks[f.matchIndex]?.home ?? null}
                  predictedAway={picks[f.matchIndex]?.away ?? null}
                  onChange={(h, a) =>
                    handlePickChange(f.matchIndex, h, a)
                  }
                  disabled={props.locked}
                />
              ))}
            </div>

            {!props.locked ? (
              <div className="mt-6 space-y-2">
                <Button
                  type="button"
                  onClick={onSave}
                  disabled={state.kind === "saving"}
                  className="w-full h-12"
                >
                  {state.kind === "saving" ? "Saving…" : "Save picks"}
                </Button>
                {state.kind === "error" && (
                  <p className="text-sm text-destructive text-center">
                    {state.message}
                  </p>
                )}
                {state.kind === "saved" && (
                  <p className="text-sm text-muted-foreground text-center">
                    Saved ✓
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 border border-destructive/30 rounded-card px-4 py-3">
                <p className="text-sm text-destructive font-medium">
                  ● Locked
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Kickoff has passed. Picks are sealed.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function initialPicks(
  fixtures: Fixture[],
  existing: Record<number, { home: number; away: number }>,
): Record<number, Pick> {
  const out: Record<number, Pick> = {};
  for (const f of fixtures) {
    const e = existing[f.matchIndex];
    out[f.matchIndex] = e
      ? { home: e.home, away: e.away }
      : { home: null, away: null };
  }
  return out;
}

function formatStartsAt(iso: string): string {
  const d = new Date(iso);
  const day = d
    .toLocaleDateString("en-GB", { weekday: "short" })
    .toUpperCase();
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `Starts ${day} · ${time}`;
}
