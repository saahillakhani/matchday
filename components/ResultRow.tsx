import { TeamBadge } from "./TeamBadge";
import type { ScoreLabel } from "@/lib/scoring";

type Props = {
  home: string;
  away: string;
  kickoff: string | null;
  actual: { home: number; away: number } | null;
  mine: { home: number; away: number } | null;
  label: ScoreLabel;
  points: number;
  bonus: number;
};

export function ResultRow({
  home,
  away,
  kickoff,
  actual,
  mine,
  label,
  points,
  bonus,
}: Props) {
  return (
    <div className="border-t border-border py-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
        {formatKickoff(kickoff)}
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamBadge team={home} />
          <span className="text-sm truncate">{home}</span>
        </div>

        {actual ? (
          <span className="font-mono text-xl font-semibold tabular-nums">
            {actual.home} — {actual.away}
          </span>
        ) : (
          <span className="font-mono text-xl text-muted-foreground">
            · · ·
          </span>
        )}

        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-sm truncate text-right">{away}</span>
          <TeamBadge team={away} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5 text-xs">
        <span className="text-muted-foreground">
          You picked{" "}
          <span className="font-mono">
            {mine ? `${mine.home}–${mine.away}` : "—"}
          </span>
        </span>
        <LabelBadge label={label} points={points} bonus={bonus} />
      </div>
    </div>
  );
}

function LabelBadge({
  label,
  points,
  bonus,
}: {
  label: ScoreLabel;
  points: number;
  bonus: number;
}) {
  if (label === "—") {
    return <span className="font-mono text-muted-foreground">—</span>;
  }
  if (label === "0") {
    return <span className="font-mono text-muted-foreground">+0</span>;
  }

  const text =
    label === "EXACT"
      ? `+${points} EXACT`
      : label === "RESULT"
        ? `+${points} RESULT`
        : `+${bonus} BONUS`;

  // EXACT in bold green; RESULT and BONUS regular green.
  const isExact = label === "EXACT";

  return (
    <span
      className={[
        "font-mono uppercase tracking-widest",
        isExact ? "text-accent-green font-bold" : "text-accent-green",
      ].join(" ")}
    >
      {text}
    </span>
  );
}

function formatKickoff(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const day = d
    .toLocaleDateString("en-GB", { weekday: "short" })
    .toUpperCase();
  const date = d.getUTCDate();
  const month = d
    .toLocaleDateString("en-GB", { month: "short" })
    .toUpperCase();
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${day} · ${date} ${month} · ${time}`;
}
