import { MAX_LEAGUE_SIZE } from "@/lib/constants";

export function Full({
  leagueName,
  memberCount,
}: {
  leagueName: string;
  memberCount: number;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-8 py-16">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
        Full
      </p>
      <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight mt-3">
        No room.
      </h1>
      <p className="text-muted-foreground italic mt-4 max-w-md">
        <span className="text-foreground font-medium">{leagueName}</span> is at
        capacity — {memberCount} of {MAX_LEAGUE_SIZE} members. Catch the next
        one.
      </p>
    </main>
  );
}
