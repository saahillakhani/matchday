type Props = {
  displayName: string;
  isStarter?: boolean;
  isOnClock?: boolean;
};

export function PlayerChip({ displayName, isStarter, isOnClock }: Props) {
  const base =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap";
  const variant = isStarter
    ? "bg-foreground text-background"
    : "border border-border text-muted-foreground bg-white";
  const clock = isOnClock ? "ring-2 ring-accent ring-offset-2" : "";

  return (
    <span className={[base, variant, clock].join(" ")}>
      {isOnClock && (
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-accent"
        />
      )}
      <span>{displayName}</span>
      {isStarter && (
        <span className="text-[9px] uppercase tracking-widest opacity-80">
          starter
        </span>
      )}
    </span>
  );
}
