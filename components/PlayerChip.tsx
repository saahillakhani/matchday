type Props = {
  displayName: string;
  isStarter?: boolean;
};

export function PlayerChip({ displayName, isStarter }: Props) {
  const base =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap";
  const variant = isStarter
    ? "bg-foreground text-background"
    : "border border-border text-muted-foreground bg-white";

  return (
    <span className={[base, variant].join(" ")}>
      <span>{displayName}</span>
      {isStarter && (
        <span className="text-[9px] uppercase tracking-widest opacity-80">
          starter
        </span>
      )}
    </span>
  );
}
