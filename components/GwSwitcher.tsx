"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  currentGw: number; // the league's current_gw (drives the "OPEN" marker)
  selectedGw: number; // which GW the user is viewing
  onChange: (gw: number) => void;
};

const MIN_GW = 1;
const MAX_GW = 38;

export function GwSwitcher({ currentGw, selectedGw, onChange }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Keep the selected pill in view (centered when possible).
  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedGw]);

  const gws: number[] = [];
  for (let i = MIN_GW; i <= MAX_GW; i++) gws.push(i);

  const canBack = selectedGw > MIN_GW;
  const canForward = selectedGw < MAX_GW;

  return (
    <div className="flex items-center gap-2 w-full">
      <button
        type="button"
        onClick={() => onChange(selectedGw - 1)}
        disabled={!canBack}
        className="p-1 text-muted-foreground disabled:opacity-30 shrink-0"
        aria-label="Previous gameweek"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div
        ref={scrollerRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1 scroll-smooth"
      >
        {gws.map((gw) => {
          const isSelected = gw === selectedGw;
          const isCurrent = gw === currentGw;
          return (
            <button
              key={gw}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              onClick={() => onChange(gw)}
              className={[
                "px-3 py-1 rounded-full text-sm font-mono whitespace-nowrap transition-colors shrink-0",
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
        className="p-1 text-muted-foreground disabled:opacity-30 shrink-0"
        aria-label="Next gameweek"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
