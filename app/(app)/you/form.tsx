"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { FormBars } from "@/components/FormBars";
import { NavTabs } from "@/components/NavTabs";
import { StatCard } from "@/components/StatCard";
import { createClient } from "@/lib/supabase/browser";

type Bar = {
  gw: number;
  points: number;
  isBest: boolean;
  isLive: boolean;
};

type Props = {
  leagueId: string;
  leagueName: string;
  leagueCode: string;
  displayName: string;
  points: number;
  position: number;
  totalMembers: number;
  weekPoints: number;
  exacts: number;
  bonusTotal: number;
  formBars: Bar[];
};

export function YouView(props: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`you:${props.leagueId}`)
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

  const positionLabel = ordinal(props.position);

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

        <div className="flex items-start justify-between mt-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Your form
            </p>
            <h1 className="font-serif text-5xl font-semibold leading-tight mt-2">
              {props.displayName}
            </h1>
          </div>
          <Link
            href={`/settings?leagueId=${props.leagueId}`}
            aria-label="Settings"
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <SettingsIcon className="w-5 h-5" />
          </Link>
        </div>

        <div className="mt-6">
          <NavTabs current="you" leagueId={props.leagueId} />
        </div>

        <Link
          href={`/settings?leagueId=${props.leagueId}`}
          className="mt-6 block border border-border rounded-card px-4 py-3 bg-white hover:border-foreground transition-colors"
        >
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                League
              </p>
              <p className="font-medium mt-0.5">{props.leagueName}</p>
            </div>
            <p className="text-xs text-muted-foreground">Settings ›</p>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <StatCard
            variant="dark"
            value={props.points}
            label={`Points · ${positionLabel}`}
          />
          <StatCard
            variant="dark"
            value={props.weekPoints === 0 ? "0" : `+${props.weekPoints}`}
            label="This week"
          />
          <StatCard
            variant="light"
            value={props.exacts}
            label="Exact scores"
          />
          <StatCard
            variant="light"
            value={props.bonusTotal}
            label="Bonus points"
          />
        </div>

        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Form · {formRangeLabel(props.formBars)}
          </p>
          <div className="mt-3 overflow-x-auto pb-2 scrollbar-none">
            <FormBars
              bars={props.formBars}
              barWidth={28}
              height={80}
              showLabels
            />
          </div>
        </div>

        {/* TODO post-MVP: The Cabinet (achievement tiles) */}
      </div>
    </main>
  );
}

function ordinal(n: number): string {
  if (n <= 0) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function formRangeLabel(bars: Bar[]): string {
  if (bars.length === 0) return "no GWs played yet";
  if (bars.length === 1) return `GW ${bars[0].gw}`;
  return `GWs ${bars[0].gw}–${bars[bars.length - 1].gw}`;
}
