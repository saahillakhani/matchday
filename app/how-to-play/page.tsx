import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "How to play · The Matchday",
};

export default function HowToPlayPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  // Return to wherever the reader came from. Only honour internal paths
  // (start with a single "/") so the param can't become an open redirect.
  const raw = searchParams.from ?? "";
  const backHref =
    raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:py-12">
      <div className="max-w-xl mx-auto">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3 h-3" />
          Back
        </Link>

        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-6">
          The rules
        </p>
        <h1 className="font-serif text-5xl font-semibold leading-tight mt-2">
          How to play
        </h1>
        <p className="text-sm text-muted-foreground italic mt-3">
          Predict the scores. Win the bragging rights. Here&apos;s the whole
          game in a couple of minutes.
        </p>

        <div className="mt-8 space-y-7">
          <Section n="1" title="Pick your six">
            When a league is created, it locks in six Premier League teams for
            the whole season. Every gameweek, you predict the scores of every
            match those six teams play.
          </Section>

          <Section n="2" title="Predict every gameweek">
            Head to the Predict tab, enter a score for each fixture, and you&apos;re
            in. Scroll the gameweek bar to look ahead — you can fill in future
            weeks early if you&apos;re going to be away.
          </Section>

          <Section n="3" title="Mind the rotation">
            Each gameweek has a pick order, set randomly when the league locks
            and rotated by one every week. You can see the picks of everyone
            above you in this week&apos;s order — once they&apos;ve submitted.
            Picking later means more information, so the order matters.
          </Section>

          <Section n="4" title="Save, then Submit">
            <span className="font-medium text-foreground">Save</span> keeps a
            private draft — edit it as much as you like, nobody else sees it.{" "}
            <span className="font-medium text-foreground">Submit</span> locks
            your picks in for the gameweek, reveals them to players below you in
            the rotation, and passes the baton on. Submitting needs every score
            filled. Forget to submit? Your draft is auto-submitted when the
            gameweek kicks off, so you never miss out.
          </Section>

          <Section n="5" title="Scoring">
            <ul className="space-y-1.5 mt-1">
              <li>
                <span className="font-mono font-semibold text-foreground">
                  3 pts
                </span>{" "}
                — exact score
              </li>
              <li>
                <span className="font-mono font-semibold text-foreground">
                  1 pt
                </span>{" "}
                — correct result (right winner or draw, wrong score)
              </li>
              <li>
                <span className="font-mono font-semibold text-foreground">
                  0 pts
                </span>{" "}
                — wrong result
              </li>
            </ul>
            <p className="mt-3">
              There&apos;s also a{" "}
              <span className="font-medium text-foreground">bonus point</span>,
              tracked separately: if you didn&apos;t get the result but did nail
              one team&apos;s score exactly, that&apos;s 1 bonus. Bonuses never
              touch your main total — they&apos;re the tiebreaker if two players
              finish the season level on points.
            </p>
          </Section>

          <Section n="6" title="Kickoff locks it">
            The moment the first match of a gameweek kicks off, that gameweek
            seals. No more edits, and everyone&apos;s picks become visible to
            everyone. Results and the table update automatically as the games
            finish.
          </Section>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <Link
            href={backHref}
            className="text-sm font-medium underline underline-offset-4"
          >
            Got it — take me back →
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-muted-foreground">{n}</span>
        <h2 className="font-serif text-xl font-semibold">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
        {children}
      </div>
    </section>
  );
}
