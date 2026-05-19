import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MAX_LEAGUE_SIZE } from "@/lib/constants";

export default async function Home({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  // Safety net: if a magic-link `?code=` lands on / (because Supabase fell
  // back to Site URL instead of our /auth/callback), forward it ourselves.
  if (searchParams.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(searchParams.code)}`);
  }

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

  // RLS lets a member read all league_members rows for leagues they're in,
  // so we can count members per league with one query.
  const allMembersPromise = user
    ? supabase.from("league_members").select("league_id")
    : Promise.resolve({ data: null });

  const [{ data: profile }, { data: memberships }, { data: allMembers }] =
    await Promise.all([profilePromise, leaguesPromise, allMembersPromise]);

  const memberCountByLeague = new Map<string, number>();
  for (const row of allMembers ?? []) {
    memberCountByLeague.set(
      row.league_id!,
      (memberCountByLeague.get(row.league_id!) ?? 0) + 1,
    );
  }

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
            <div className="w-full space-y-2">
              <Link href="/league/new" className="block">
                <Button className="w-full">Create a league</Button>
              </Link>
              <Link href="/join" className="block">
                <Button variant="outline" className="w-full">
                  Join with a code
                </Button>
              </Link>
            </div>
          ) : (
            <div className="w-full space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Your leagues
              </p>
              <div className="space-y-2">
                {leagues.map((l) => {
                  const count = memberCountByLeague.get(l.id) ?? 0;
                  const full = count >= MAX_LEAGUE_SIZE;
                  return (
                    <Link
                      key={l.id}
                      href={`/predict?leagueId=${l.id}`}
                      className="block border border-border rounded-card px-4 py-3 text-left bg-white hover:border-foreground transition-colors"
                    >
                      <p className="font-medium">{l.name}</p>
                      <div className="flex items-baseline justify-between mt-1">
                        <p className="font-mono text-xs text-muted-foreground">
                          code · {l.code}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {count} / {MAX_LEAGUE_SIZE}
                          {full && (
                            <span className="ml-1 text-foreground">· full</span>
                          )}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Link href="/league/new" className="block">
                  <Button variant="outline" className="w-full">
                    Create another league
                  </Button>
                </Link>
                <Link href="/join" className="block">
                  <Button variant="outline" className="w-full">
                    Join with a code
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <Link
            href="/how-to-play"
            className="text-sm text-muted-foreground underline underline-offset-4 pt-2"
          >
            How to play
          </Link>

          <form action="/auth/signout" method="post" className="pt-2">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      )}
    </main>
  );
}
