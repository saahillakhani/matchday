type Props = {
  variant: "dark" | "light";
  value: string | number;
  label: string;
};

export function StatCard({ variant, value, label }: Props) {
  const base =
    "rounded-card px-5 py-5 flex flex-col items-start justify-between min-h-[120px]";
  const variantClasses =
    variant === "dark"
      ? "bg-card text-card-foreground"
      : "bg-white border border-border text-foreground";

  return (
    <div className={[base, variantClasses].join(" ")}>
      <p className="font-serif text-5xl font-semibold leading-none tabular-nums">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-widest opacity-70 mt-3">
        {label}
      </p>
    </div>
  );
}
