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
  // Window of `2*range + 1` pills centered on selectedGw, shifted away
  // from the edges so the visible width stays constant. Without the
  // shift, GW 38 would only show 35-38 (4 pills) and GW 1 would only
  // show 1-4. Now both ends still get the full 7-pill row.
  const width = 2 * range + 1;
  let start = selectedGw - range;
  let end = selectedGw + range;
  if (start < MIN_GW) {
    start = MIN_GW;
    end = Math.min(MAX_GW, start + width - 1);
  } else if (end > MAX_GW) {
    end = MAX_GW;
    start = Math.max(MIN_GW, end - width + 1);
  }
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
