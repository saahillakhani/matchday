"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GwSwitcher } from "@/components/GwSwitcher";
import { NavTabs } from "@/components/NavTabs";
import { ResultRow } from "@/components/ResultRow";
import { createClient } from "@/lib/supabase/browser";
import type { Aggregate, ScoreLabel } from "@/lib/scoring";

type Match = {
  matchIndex: number;
  home: string;
  away: string;
  kickoff: string | null;
  mine: { home: number; away: number } | null;
  actual: { home: number; away: number } | null;
  label: ScoreLabel;
  points: number;
  bonus: number;
};

type Props = {
  leagueId: string;
  leagueName: string;
  currentGw: number;
  selectedGw: number;
  matches: Match[];
  summary: Aggregate;
  remaining: number;
  isFuture: boolean;
};

export function ResultsView(props: Props) {
  const router = useRouter();

  // Realtime: refresh server data whenever predictions or results for this
  // league change. Cheap because the page is server-rendered — refresh()
  // just re-runs the data fetch and patches the client tree.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`results:${props.leagueId}:${props.selectedGw}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "results",
          filter: `league_id=eq.${props.leagueId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "predictions",
          filter: `league_id=eq.${props.leagueId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [props.leagueId, props.selectedGw, router]);

  function gwChange(gw: number) {
    const params = new URLSearchParams({
      leagueId: props.leagueId,
      gw: String(gw),
    });
    router.push(`/results?${params.toString()}`);
  }

  const { points, exacts, results, bonuses } = props.summary;
  const total = props.matches.length;

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
          Results
        </h1>

        <div className="mt-6">
          <NavTabs current="results" leagueId={props.leagueId} />
        </div>

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
            <Summary
              points={points}
              exacts={exacts}
              results={results}
              bonuses={bonuses}
              remaining={props.remaining}
              total={total}
              isFuture={props.isFuture}
            />

            <div className="mt-4">
              {props.matches.map((m) => (
                <ResultRow
                  key={m.matchIndex}
                  home={m.home}
                  away={m.away}
                  kickoff={m.kickoff}
                  actual={m.actual}
                  mine={m.mine}
                  label={m.label}
                  points={m.points}
                  bonus={m.bonus}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Summary({
  points,
  exacts,
  results,
  bonuses,
  remaining,
  total,
  isFuture,
}: {
  points: number;
  exacts: number;
  results: number;
  bonuses: number;
  remaining: number;
  total: number;
  isFuture: boolean;
}) {
  return (
    <div className="mt-8">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
        Your gameweek
      </p>
      <p className="font-serif text-7xl font-semibold leading-none mt-2 tabular-nums">
        {points}
      </p>
      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-3">
        points
        <span className="mx-1.5">·</span>
        {exacts} exact
        <span className="mx-1.5">·</span>
        {results} result
        <span className="mx-1.5">·</span>
        {bonuses} bonus
      </p>
      <p className="text-sm italic text-muted-foreground mt-3">
        {isFuture
          ? "This gameweek hasn't kicked off yet."
          : remaining === 0
            ? total === 0
              ? ""
              : "All in. See you next gameweek."
            : `${remaining} fixture${remaining === 1 ? "" : "s"} left to play.`}
      </p>
    </div>
  );
}
