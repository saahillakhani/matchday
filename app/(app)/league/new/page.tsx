import { getTeams } from "@/lib/fpl";
import { NewLeagueForm } from "./form";

export default async function NewLeaguePage() {
  const teams = await getTeams();

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          New league
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight mt-3">
          Pick your six.
        </h1>
        <p className="text-muted-foreground italic mt-3">
          Choose six Premier League teams. Every gameweek, you predict the
          scores of any match they play.
        </p>
      </div>

      <div className="w-full max-w-xl mt-10">
        <NewLeagueForm teams={teams} />
      </div>
    </main>
  );
}
