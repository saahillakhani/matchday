import { teamCode, teamColor } from "@/lib/teams";

type Props = {
  team: string;
  size?: "sm" | "md" | "lg";
};

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  sm: "w-6 h-6 text-[9px]",
  md: "w-8 h-8 text-[10px]",
  lg: "w-10 h-10 text-xs",
};

export function TeamBadge({ team, size = "md" }: Props) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center rounded-full font-mono font-semibold text-white shrink-0",
        SIZES[size],
      ].join(" ")}
      style={{ backgroundColor: teamColor(team) }}
      aria-label={team}
    >
      {teamCode(team)}
    </span>
  );
}
