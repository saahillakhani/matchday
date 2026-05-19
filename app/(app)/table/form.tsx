"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FormBars } from "@/components/FormBars";
import { NavTabs } from "@/components/NavTabs";
import { ShareButton, ShareCapture } from "@/components/share";
import { createClient } from "@/lib/supabase/browser";

type TableRow = {
  rank: number;
  userId: string;
  displayName: string;
  isMe: boolean;
  gw: number;
  bn: number;
  bns: number;
  pts: number;
};

type Bar = {
  gw: number;
  points: number;
  isBest: boolean;
  isLive: boolean;
};

type Player = {
  userId: string;
  displayName: string;
  isMe: boolean;
  total: number;
  perGw: Bar[];
};

type Verdict = {
  gw: number;
  headline: string;
  topOfGw: { name: string; points: number; exacts: number } | null;
  bestPick: { name: string; scoreline: string; fixture: string } | null;
  worstPick: {
    name: string;
    predicted: string;
    actual: string;
    fixture: string;
  } | null;
};

type View = "table" | "form";

type Props = {
  leagueId: string;
  leagueName: string;
  tableRows: TableRow[];
  afterGw: number | null;
  latestGwComplete: boolean;
  players: Player[];
  verdict: Verdict | null;
};

export function TableView(props: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("table");
  const tableShareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`table:${props.leagueId}`)
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [props.leagueId, router]);

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
          The Table
        </h1>
        {props.afterGw !== null && (
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-2">
            {props.latestGwComplete
              ? `After GW ${props.afterGw}`
              : `GW ${props.afterGw} still in play`}
          </p>
        )}

        <div className="mt-6">
          <NavTabs current="table" leagueId={props.leagueId} />
        </div>

        <ViewToggle view={view} onChange={setView} />

        {view === "table" ? (
          <>
            {props.tableRows.length > 0 && (
              <div className="mt-4 flex justify-end">
                <ShareButton
                  targetRef={tableShareRef}
                  filename={`matchday-gw${props.afterGw ?? ""}-table.png`}
                  shareTitle={`${props.leagueName} — the table`}
                />
              </div>
            )}
            <SeasonTable rows={props.tableRows} />
            {props.tableRows.length > 0 && (
              <ShareCapture
                ref={tableShareRef}
                subtitle={`${props.leagueName} · ${
                  props.afterGw !== null
                    ? `after GW ${props.afterGw}`
                    : "the table"
                }`}
              >
                <SeasonTable rows={props.tableRows} />
              </ShareCapture>
            )}
          </>
        ) : (
          <FormGrid players={props.players} />
        )}

        {view === "table" && props.verdict && (
          <VerdictCard verdict={props.verdict} />
        )}
      </div>
    </main>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  const base =
    "flex-1 px-3 py-2 text-xs uppercase tracking-widest rounded-full transition-colors";
  return (
    <div className="mt-5 flex items-center gap-1 bg-secondary p-1 rounded-full">
      <button
        type="button"
        onClick={() => onChange("table")}
        className={[
          base,
          view === "table"
            ? "bg-foreground text-background"
            : "text-muted-foreground",
        ].join(" ")}
      >
        Season table
      </button>
      <button
        type="button"
        onClick={() => onChange("form")}
        className={[
          base,
          view === "form"
            ? "bg-foreground text-background"
            : "text-muted-foreground",
        ].join(" ")}
      >
        Form grid
      </button>
    </div>
  );
}

function SeasonTable({ rows }: { rows: TableRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted-foreground italic text-center">
        No members yet.
      </p>
    );
  }
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
            <th className="text-left pb-2 pr-2 font-medium w-6">#</th>
            <th className="text-left pb-2 pr-3 font-medium">Player</th>
            <th className="text-right pb-2 px-2 font-medium font-mono">GW</th>
            <th className="text-right pb-2 px-2 font-medium font-mono">BN</th>
            <th className="text-right pb-2 px-2 font-medium font-mono">BNS</th>
            <th className="text-right pb-2 pl-2 font-medium font-mono">PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-t border-border">
              <td className="py-3 pr-2 font-mono text-muted-foreground">
                {r.rank}
              </td>
              <td className="py-3 pr-3">
                <span className="font-medium">{r.displayName}</span>
                {r.isMe && (
                  <span className="ml-2 text-[9px] uppercase tracking-widest text-muted-foreground">
                    you
                  </span>
                )}
              </td>
              <td className="py-3 px-2 text-right font-mono tabular-nums">
                {r.gw === 0 ? "—" : `+${r.gw}`}
              </td>
              <td className="py-3 px-2 text-right font-mono tabular-nums text-muted-foreground">
                {r.bn === 0 ? "0" : `+${r.bn}`}
              </td>
              <td className="py-3 px-2 text-right font-mono tabular-nums text-muted-foreground">
                {r.bns}
              </td>
              <td className="py-3 pl-2 text-right font-mono tabular-nums font-semibold">
                {r.pts}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormGrid({ players }: { players: Player[] }) {
  if (players.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted-foreground italic text-center">
        No members yet.
      </p>
    );
  }

  const gwsByPlayer = players[0]?.perGw ?? [];
  const range = gwsByPlayer.length
    ? `GWs ${gwsByPlayer[0].gw}–${gwsByPlayer[gwsByPlayer.length - 1].gw}`
    : "no GWs scored yet";

  return (
    <div className="mt-6">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Form · {range}
      </p>
      <p className="text-xs italic text-muted-foreground mt-1">
        Bars show points per gameweek. Green = player&apos;s best.
      </p>

      <div className="mt-6 space-y-5">
        {players.map((p) => (
          <div
            key={p.userId}
            className="flex items-center gap-4 pb-2"
          >
            <div className="w-24 shrink-0">
              <p className="font-medium text-sm">{p.displayName}</p>
              {p.isMe && (
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  you
                </p>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <FormBars bars={p.perGw} barWidth={22} showLabels />
            </div>
            <p className="font-mono tabular-nums text-sm font-semibold w-10 text-right shrink-0">
              {p.total}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerdictCard({ verdict }: { verdict: Verdict }) {
  return (
    <section className="mt-8 border-t border-border pt-6">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        The Verdict · last completed gameweek
      </p>
      <p className="font-serif text-xl italic font-medium leading-snug mt-2">
        {verdict.headline}
      </p>

      <div className="mt-4 border border-border rounded-card bg-white divide-y divide-border">
        <VerdictRow label={`★ Top of GW ${verdict.gw}`}>
          {verdict.topOfGw ? (
            <>
              <span className="font-medium">{verdict.topOfGw.name}</span>
              <span className="font-mono text-muted-foreground ml-2">
                {verdict.topOfGw.points} pts
                {verdict.topOfGw.exacts > 0 &&
                  ` · ${verdict.topOfGw.exacts} exact`}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground italic">—</span>
          )}
        </VerdictRow>

        <VerdictRow label="Best pick">
          {verdict.bestPick ? (
            <>
              <span className="font-medium">{verdict.bestPick.name}</span>
              <span className="text-muted-foreground ml-2">
                called {verdict.bestPick.scoreline} ·{" "}
                {verdict.bestPick.fixture}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground italic">
              No exact scores this week
            </span>
          )}
        </VerdictRow>

        <VerdictRow label="Worst pick">
          {verdict.worstPick ? (
            <>
              <span className="font-medium">{verdict.worstPick.name}</span>
              <span className="text-muted-foreground ml-2">
                said {verdict.worstPick.predicted}, it ended{" "}
                {verdict.worstPick.actual}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground italic">—</span>
          )}
        </VerdictRow>
      </div>
    </section>
  );
}

function VerdictRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-sm mt-1">{children}</p>
    </div>
  );
}
