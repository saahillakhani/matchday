"use client";

import { ScoreInput } from "./ScoreInput";
import { TeamBadge } from "./TeamBadge";

type Props = {
  home: string;
  away: string;
  kickoff: string | null;
  predictedHome: number | null;
  predictedAway: number | null;
  onChange: (home: number | null, away: number | null) => void;
  disabled?: boolean;
};

export function MatchRow({
  home,
  away,
  kickoff,
  predictedHome,
  predictedAway,
  onChange,
  disabled,
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
        <ScoreInput
          home={predictedHome}
          away={predictedAway}
          onChange={onChange}
          disabled={disabled}
        />
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-sm truncate text-right">{away}</span>
          <TeamBadge team={away} />
        </div>
      </div>
    </div>
  );
}

function formatKickoff(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  // E.g. "SAT · 16 MAY · 14:00"
  const day = d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
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
