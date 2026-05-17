import Link from "next/link";

type Tab = "predict" | "results" | "table" | "you";

const TABS: Array<{ id: Tab; label: string; enabled: boolean }> = [
  { id: "predict", label: "Predict", enabled: true },
  { id: "results", label: "Results", enabled: true },
  { id: "table", label: "Table", enabled: true },
  { id: "you", label: "You", enabled: true },
];

function hrefFor(tab: Tab, leagueId: string): string {
  switch (tab) {
    case "predict":
      return `/predict?leagueId=${leagueId}`;
    case "results":
      return `/results?leagueId=${leagueId}`;
    case "table":
      return `/table?leagueId=${leagueId}`;
    case "you":
      return `/you?leagueId=${leagueId}`;
  }
}

export function NavTabs({
  current,
  leagueId,
}: {
  current: Tab;
  leagueId: string;
}) {
  return (
    <nav className="flex gap-6 text-xs uppercase tracking-widest border-b border-border">
      {TABS.map((t) => {
        const isActive = t.id === current;
        const base = "pb-2 -mb-px border-b-2 transition-colors";
        if (!t.enabled) {
          return (
            <span
              key={t.id}
              className={[base, "border-transparent text-muted-foreground/40 cursor-not-allowed"].join(" ")}
            >
              {t.label}
            </span>
          );
        }
        return (
          <Link
            key={t.id}
            href={hrefFor(t.id, leagueId)}
            className={[
              base,
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
