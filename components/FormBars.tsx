"use client";

import { useEffect, useRef } from "react";

type Bar = {
  gw: number;
  points: number;
  isBest: boolean;
  isLive: boolean;
};

type Props = {
  bars: Bar[];
  /** Width per bar in px; the row scrolls horizontally if needed. */
  barWidth?: number;
  height?: number;
  /** Render a small GW number under each bar. */
  showLabels?: boolean;
};

const BAR_GAP = 4;
const LABEL_HEIGHT = 14;

export function FormBars({
  bars,
  barWidth = 18,
  height = 64,
  showLabels = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pin scroll to the right edge on mount so the most recent GW is visible
  // first. Users scroll left to dig into older form.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [bars.length]);

  if (bars.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No GWs scored yet.</p>
    );
  }

  const maxPoints = Math.max(1, ...bars.map((b) => b.points));
  const innerWidth = bars.length * (barWidth + BAR_GAP) - BAR_GAP;
  const totalHeight = showLabels ? height + LABEL_HEIGHT : height;
  const barAreaHeight = height;

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto scrollbar-none"
    >
      <svg
        width={innerWidth}
        height={totalHeight}
        viewBox={`0 0 ${innerWidth} ${totalHeight}`}
        className="block"
        aria-label={`Per-gameweek points: ${bars.map((b) => `gw${b.gw}=${b.points}`).join(", ")}`}
      >
        {bars.map((b, i) => {
          const h = b.points === 0 ? 2 : (b.points / maxPoints) * (barAreaHeight - 2);
          const x = i * (barWidth + BAR_GAP);
          const y = barAreaHeight - h;
          const fill = b.isBest
            ? "#2D6A4F"
            : b.points === 0
              ? "transparent"
              : "#0A0A0A";
          return (
            <g key={b.gw}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={2}
                fill={fill}
                stroke={b.isLive ? "#0A0A0A" : "none"}
                strokeWidth={b.isLive ? 1 : 0}
                strokeDasharray={b.isLive && b.points === 0 ? "2 2" : undefined}
              >
                <title>{`GW ${b.gw}: ${b.points} pts`}</title>
              </rect>
              {showLabels && (
                <text
                  x={x + barWidth / 2}
                  y={barAreaHeight + LABEL_HEIGHT - 2}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: "9px", fontFamily: "ui-monospace, monospace" }}
                >
                  {b.gw}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
