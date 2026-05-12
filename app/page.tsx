import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profilePromise = user
    ? supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single()
    : Promise.resolve({ data: null });

  const leaguesPromise = user
    ? supabase
        .from("league_members")
        .select("leagues(id, name, code, selected_teams)")
        .eq("user_id", user.id)
    : Promise.resolve({ data: null });

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    profilePromise,
    leaguesPromise,
  ]);

  const leagues =
    memberships
      ?.map((m) => m.leagues)
      .filter((l): l is NonNullable<typeof l> => l !== null) ?? [];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
        Est · 2026
      </p>
      <h1 className="font-serif text-6xl font-semibold leading-none">
        The Matchday
      </h1>

      {!user ? (
        <Link href="/sign-in">
          <Button>Sign in</Button>
        </Link>
      ) : (
        <div className="flex flex-col items-center gap-4 mt-6 w-full max-w-sm">
          <p className="text-muted-foreground">
            Signed in as{" "}
            <span className="text-foreground font-medium">
              {profile?.display_name ?? user.email}
            </span>
          </p>

          {leagues.length === 0 ? (
            <Link href="/league/new">
              <Button>Create a league</Button>
            </Link>
          ) : (
            <div className="w-full space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Your leagues
              </p>
              <div className="space-y-2">
                {leagues.map((l) => (
                  <div
                    key={l.id}
                    className="border border-border rounded-card px-4 py-3 text-left bg-white"
                  >
                    <p className="font-medium">{l.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      code · {l.code}
                    </p>
                  </div>
                ))}
              </div>
              <Link href="/league/new" className="block">
                <Button variant="outline" className="w-full">
                  Create another league
                </Button>
              </Link>
            </div>
          )}

          <form action="/auth/signout" method="post" className="pt-4">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      )}
    </main>
  );
}
