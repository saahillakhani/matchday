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
};

const BAR_GAP = 4;

export function FormBars({ bars, barWidth = 18, height = 64 }: Props) {
  if (bars.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No GWs scored yet.</p>
    );
  }

  // Scale relative to the largest bar across the whole row so heights stay
  // comparable within one player.
  const maxPoints = Math.max(1, ...bars.map((b) => b.points));
  const innerWidth = bars.length * (barWidth + BAR_GAP) - BAR_GAP;

  return (
    <svg
      width={innerWidth}
      height={height}
      viewBox={`0 0 ${innerWidth} ${height}`}
      className="block"
      aria-label={`Per-gameweek points: ${bars.map((b) => `gw${b.gw}=${b.points}`).join(", ")}`}
    >
      {bars.map((b, i) => {
        const h = b.points === 0 ? 2 : (b.points / maxPoints) * (height - 2);
        const x = i * (barWidth + BAR_GAP);
        const y = height - h;
        const fill = b.isBest
          ? "var(--accent)"
          : b.points === 0
            ? "transparent"
            : "var(--ink)";
        const stroke = b.isLive ? "var(--ink)" : "none";
        return (
          <rect
            key={b.gw}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={2}
            fill={fill === "var(--accent)" ? "#2D6A4F" : fill === "var(--ink)" ? "#0A0A0A" : "transparent"}
            stroke={stroke === "var(--ink)" ? "#0A0A0A" : "none"}
            strokeWidth={b.isLive ? 1 : 0}
            strokeDasharray={b.isLive && b.points === 0 ? "2 2" : undefined}
          >
            <title>{`GW ${b.gw}: ${b.points} pts`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
