type Props = {
  displayName: string;
  isStarter?: boolean;
  isMe?: boolean;
};

export function PlayerChip({ displayName, isStarter, isMe }: Props) {
  const base =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap";
  const variant = isStarter
    ? "bg-foreground text-background"
    : "border border-border text-muted-foreground bg-white";
  const meRing = isMe ? "ring-2 ring-accent ring-offset-2" : "";

  return (
    <span className={[base, variant, meRing].join(" ")}>
      <span>{displayName}</span>
      {isStarter && (
        <span className="text-[9px] uppercase tracking-widest opacity-80">
          starter
        </span>
      )}
    </span>
  );
}
