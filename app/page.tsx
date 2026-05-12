import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
        Est · 2026
      </p>
      <h1 className="font-serif text-6xl font-semibold leading-none">
        The Matchday
      </h1>

      {user ? (
        <div className="flex flex-col items-center gap-4 mt-6">
          <p className="text-muted-foreground">
            Signed in as{" "}
            <span className="text-foreground font-medium">{user.email}</span>
          </p>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      ) : (
        <Link href="/sign-in">
          <Button>Sign in</Button>
        </Link>
      )}

      <p className="font-mono text-xs text-muted-foreground pt-8">
        auth wired · awaiting league flow
      </p>
    </main>
  );
}
