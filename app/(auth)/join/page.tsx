import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueByCode } from "@/lib/league-lookup";
import { CodeForm } from "./code-form";
import { JoinConfirm } from "./confirm";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const code = searchParams.code?.trim().toLowerCase();

  // No code in URL — ask for one.
  if (!code) {
    return <CodeForm />;
  }

  const supabase = createClient();
  const { league } = await getLeagueByCode(supabase, code);

  // Code doesn't match any league — re-prompt with error.
  if (!league) {
    return <CodeForm initialCode={code} error="No league with that code." />;
  }

  if (league.locked) {
    return <Locked leagueName={league.name} />;
  }

  // Stash the code and redirect to sign-in if the visitor isn't authed yet.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    cookies().set("pendingLeagueCode", code, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60, // 1 hour
    });
    redirect("/sign-in?intent=join");
  }

  return <JoinConfirm code={code} leagueName={league.name} />;
}

function Locked({ leagueName }: { leagueName: string }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-8 py-16">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
        Locked
      </p>
      <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight mt-3">
        Too late.
      </h1>
      <p className="text-muted-foreground italic mt-4 max-w-md">
        <span className="text-foreground font-medium">{leagueName}</span> has
        already kicked off. No new members until next season.
      </p>
    </main>
  );
}
