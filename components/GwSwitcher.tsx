"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  currentGw: number; // the league's current_gw (drives the "OPEN" marker)
  selectedGw: number; // which GW the user is viewing
  onChange: (gw: number) => void;
  range?: number; // pills shown either side of currentGw (default 3)
};

const MIN_GW = 1;
const MAX_GW = 38;

export function GwSwitcher({
  currentGw,
  selectedGw,
  onChange,
  range = 3,
}: Props) {
  const start = Math.max(MIN_GW, currentGw - range);
  const end = Math.min(MAX_GW, currentGw + range);
  const gws: number[] = [];
  for (let i = start; i <= end; i++) gws.push(i);

  const canBack = selectedGw > MIN_GW;
  const canForward = selectedGw < MAX_GW;

  return (
    <div className="flex items-center gap-2 w-full">
      <button
        type="button"
        onClick={() => onChange(selectedGw - 1)}
        disabled={!canBack}
        className="p-1 text-muted-foreground disabled:opacity-30"
        aria-label="Previous gameweek"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
        {gws.map((gw) => {
          const isSelected = gw === selectedGw;
          const isCurrent = gw === currentGw;
          return (
            <button
              key={gw}
              type="button"
              onClick={() => onChange(gw)}
              className={[
                "px-3 py-1 rounded-full text-sm font-mono whitespace-nowrap transition-colors",
                isSelected
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:border-foreground hover:text-foreground",
              ].join(" ")}
            >
              {gw}
              {isCurrent && (
                <span className="ml-1 text-[10px] uppercase tracking-wider">
                  open
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange(selectedGw + 1)}
        disabled={!canForward}
        className="p-1 text-muted-foreground disabled:opacity-30"
        aria-label="Next gameweek"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
