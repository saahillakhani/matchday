type Props = {
  displayName: string;
  /** Green dot — this player is next up in the rotation. */
  isOnClock?: boolean;
};

export function PlayerChip({ displayName, isOnClock }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap border border-border bg-white text-muted-foreground">
      {isOnClock && (
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-accent" />
      )}
      <span>{displayName}</span>
    </span>
  );
}
