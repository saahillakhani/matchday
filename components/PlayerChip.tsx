import { Check } from "lucide-react";

type Props = {
  displayName: string;
  /** Green dot — this player is next up in the rotation. */
  isOnClock?: boolean;
  /** This player has submitted their picks for the gameweek. */
  hasSubmitted?: boolean;
};

export function PlayerChip({
  displayName,
  isOnClock,
  hasSubmitted,
}: Props) {
  // Submitted players get a filled tint + tick; the on-clock player gets
  // the green dot. A player is never both (on-clock = first un-submitted).
  const variant = hasSubmitted
    ? "border-accent/40 bg-accent/5 text-foreground"
    : "border-border bg-white text-muted-foreground";

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap border",
        variant,
      ].join(" ")}
    >
      {isOnClock && (
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-accent" />
      )}
      <span>{displayName}</span>
      {hasSubmitted && (
        <Check aria-label="submitted" className="w-3 h-3 text-accent-green" />
      )}
    </span>
  );
}
