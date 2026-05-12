"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CodeForm({
  initialCode = "",
  error,
}: {
  initialCode?: string;
  error?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return;
    router.push(`/join?code=${encodeURIComponent(trimmed)}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-8 py-16">
      <div className="w-full max-w-sm text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Join a league
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight mt-3">
          Got a code?
        </h1>
        <p className="text-muted-foreground italic mt-3">
          Enter the 6-character code from your league host.
        </p>

        <form onSubmit={onSubmit} className="space-y-3 mt-8">
          <Input
            required
            autoFocus
            placeholder="e.g. f8x3q2"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={12}
            className="h-12 text-center font-mono text-lg tracking-widest"
          />
          <Button
            type="submit"
            disabled={!code.trim()}
            className="w-full h-12"
          >
            Continue
          </Button>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </form>
      </div>
    </main>
  );
}
