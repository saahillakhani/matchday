import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateDisplayName } from "./actions";

export default async function WelcomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const emailPrefix = user.email?.split("@")[0] ?? "";
  const alreadyNamed =
    profile && profile.display_name && profile.display_name !== emailPrefix;

  // Returning users with a real name — skip welcome.
  if (alreadyNamed) redirect("/");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-8 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
        Welcome
      </p>
      <h1 className="font-serif text-5xl sm:text-6xl font-semibold leading-none mt-3">
        What should we call you?
      </h1>
      <p className="text-muted-foreground italic max-w-md mt-4">
        Your league mates will see this on the table.
      </p>

      <form action={updateDisplayName} className="space-y-3 mt-10 w-full max-w-sm">
        <Input
          name="displayName"
          required
          minLength={1}
          maxLength={30}
          placeholder="Your name"
          className="h-12 text-center text-lg"
          autoFocus
        />
        <Button type="submit" className="w-full h-12">
          Continue
        </Button>
      </form>
    </main>
  );
}
