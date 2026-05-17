"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavTabs } from "@/components/NavTabs";

type Member = {
  userId: string;
  displayName: string;
};

type Props = {
  leagueId: string;
  leagueName: string;
  leagueCode: string;
  locked: boolean;
  isCreator: boolean;
  members: Member[];
};

export function SettingsView(props: Props) {
  const [copied, setCopied] = useState(false);
  // Local-only toggle state — wired to nothing in MVP per build plan.
  // The screen visually completes the design; persistence comes post-v1.
  const [notifications, setNotifications] = useState(true);
  const [lockAtKickoff, setLockAtKickoff] = useState(true);

  function copyCode() {
    navigator.clipboard.writeText(props.leagueCode).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:py-12">
      <div className="max-w-xl mx-auto">
        <Link
          href={`/you?leagueId=${props.leagueId}`}
          className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3 h-3" />
          You
        </Link>

        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-6">
          League · Account
        </p>
        <h1 className="font-serif text-5xl font-semibold leading-tight mt-2">
          Settings
        </h1>

        <div className="mt-6">
          <NavTabs current="you" leagueId={props.leagueId} />
        </div>

        {/* Your league card */}
        <section className="mt-6 bg-white border border-border rounded-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Your league
          </p>
          <p className="font-serif text-2xl font-semibold mt-1">
            {props.leagueName}
          </p>
          <div className="flex items-center justify-between mt-3">
            <p className="font-mono text-sm text-muted-foreground">
              code · {props.leagueCode}
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="w-3 h-3" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center -space-x-2">
              {props.members.slice(0, 6).map((m) => (
                <Avatar key={m.userId} name={m.displayName} />
              ))}
              {props.members.length > 6 && (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-xs font-mono text-muted-foreground ring-2 ring-background">
                  +{props.members.length - 6}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {props.members.length} player
              {props.members.length === 1 ? "" : "s"}
            </p>
          </div>
        </section>

        {/* Settings rows */}
        <section className="mt-6">
          <SettingsRow
            label="Notifications"
            value={notifications ? "On" : "Off"}
            toggle={notifications}
            onToggle={setNotifications}
          />
          <SettingsRow
            label="Lock at kickoff"
            value="Auto"
            toggle={lockAtKickoff}
            onToggle={setLockAtKickoff}
          />
        </section>

        {/* Sign out */}
        <form action="/auth/signout" method="post" className="mt-10">
          <Button
            type="submit"
            variant="outline"
            className="w-full h-12 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
          >
            Sign out
          </Button>
        </form>

        {!props.isCreator && (
          <p className="text-xs text-muted-foreground italic mt-4 text-center">
            League name and selected teams can only be changed by the
            league creator.
          </p>
        )}
      </div>
    </main>
  );
}

function SettingsRow({
  label,
  value,
  toggle,
  onToggle,
  disabled,
}: {
  label: string;
  value: string;
  toggle?: boolean;
  onToggle?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{value}</p>
      </div>
      {toggle !== undefined && onToggle ? (
        <Toggle on={toggle} onChange={onToggle} disabled={disabled} />
      ) : (
        <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
      )}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={[
        "inline-flex items-center w-11 h-6 rounded-full px-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        on ? "justify-end bg-foreground" : "justify-start bg-muted",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        aria-hidden
        className="block w-5 h-5 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "—";
  // Stable colour from name hash
  const hue = [...name].reduce((h, c) => (h + c.charCodeAt(0)) % 360, 0);
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-mono font-semibold text-white ring-2 ring-background"
      style={{ backgroundColor: `hsl(${hue}, 35%, 35%)` }}
    >
      {initials}
    </span>
  );
}
