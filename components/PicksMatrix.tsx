import { TeamBadge } from "./TeamBadge";

type RotationEntry = {
  userId: string;
  displayName: string;
  abbr: string;
  isStarter: boolean;
};

type Fixture = {
  matchIndex: number;
  home: string;
  away: string;
};

type Picks = Record<string, Record<number, { home: number; away: number }>>;

type Props = {
  rotation: RotationEntry[];
  fixtures: Fixture[];
  picks: Picks;
  me: string;
  locked: boolean;
};

export function PicksMatrix({
  rotation,
  fixtures,
  picks,
  me,
  locked,
}: Props) {
  if (rotation.length === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground italic">
          The rotation locks in at the first kickoff of the gameweek.
          Until then, it&apos;s just you.
        </p>
      </div>
    );
  }

  if (fixtures.length === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground italic">
          No fixtures for your teams this gameweek.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 -mx-1 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 bg-background text-left text-[10px] uppercase tracking-widest text-muted-foreground font-medium pb-2 pr-3 z-10"
            >
              Match
            </th>
            {rotation.map((p) => (
              <th
                key={p.userId}
                scope="col"
                className={[
                  "text-center text-[10px] uppercase tracking-widest font-mono font-medium pb-2 px-1",
                  p.userId === me ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {p.abbr}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fixtures.map((f) => (
            <tr key={f.matchIndex} className="border-t border-border">
              <th
                scope="row"
                className="sticky left-0 bg-background text-left py-3 pr-3 z-10"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                  <TeamBadge team={f.home} size="sm" />
                  <span>/</span>
                  <TeamBadge team={f.away} size="sm" />
                </span>
              </th>
              {rotation.map((p) => {
                const cell = picks[p.userId]?.[f.matchIndex];
                const isMine = p.userId === me;
                return (
                  <td
                    key={p.userId}
                    className={[
                      "text-center font-mono py-3 px-1",
                      isMine ? "text-foreground font-semibold" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {cell ? `${cell.home}–${cell.away}` : "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!locked && (
        <p className="text-xs text-muted-foreground italic mt-4 text-center">
          Picks reveal at kickoff. League members lock in early.
        </p>
      )}
    </div>
  );
}
