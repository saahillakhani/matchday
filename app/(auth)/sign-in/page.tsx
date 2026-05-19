"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export default function SignInPage() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [email, setEmail] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "submitting" });

    const supabase = createClient();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${appUrl}/auth/callback` },
    });

    if (error) {
      setState({ kind: "error", message: error.message });
    } else {
      setState({ kind: "sent", email });
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col justify-center items-center text-center px-8 py-16 bg-background">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Est · 2026
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl font-semibold leading-none mt-3">
          The Matchday
        </h1>
        <p className="text-muted-foreground italic max-w-md mt-4">
          Predict the scores. Win the bragging rights. A small private league
          for people who think they know better.
        </p>
        <p className="font-mono text-xs text-muted-foreground mt-6">
          Private league · 38 weeks
        </p>
      </div>

      <div className="bg-white px-8 py-10 sm:py-12 border-t border-border">
        <div className="max-w-sm mx-auto space-y-4">
          {state.kind === "sent" ? (
            <SentState
              email={state.email}
              onReset={() => {
                setState({ kind: "idle" });
                setEmail("");
              }}
            />
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <label
                htmlFor="email"
                className="text-xs uppercase tracking-widest text-muted-foreground block"
              >
                Your email
              </label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={state.kind === "submitting"}
                className="h-12"
              />
              <Button
                type="submit"
                disabled={state.kind === "submitting" || !email}
                className="w-full h-12"
              >
                {state.kind === "submitting"
                  ? "Sending…"
                  : "Send sign-in link"}
              </Button>
              {state.kind === "error" && (
                <p className="text-sm text-destructive">{state.message}</p>
              )}
            </form>
          )}

          <p className="text-sm text-center text-muted-foreground pt-2">
            Have a league code?{" "}
            <a href="/join" className="text-foreground font-medium underline">
              Join with code →
            </a>
          </p>
          <p className="text-sm text-center text-muted-foreground">
            New here?{" "}
            <a
              href="/how-to-play"
              className="text-foreground font-medium underline"
            >
              How it works →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function SentState({
  email,
  onReset,
}: {
  email: string;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3 text-center">
      <p className="font-serif text-2xl">Check your email</p>
      <p className="text-sm text-muted-foreground">
        We sent a sign-in link to{" "}
        <span className="font-medium text-foreground">{email}</span>. Click the
        link to sign in.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="text-sm text-muted-foreground underline pt-2"
      >
        Use a different email
      </button>
    </div>
  );
}
