/**
 * FPL public API client. Free, unofficial, no auth.
 * Step 4 only needs getTeams(); step 5 will add fixtures + bootstrap helpers.
 *
 * The bootstrap endpoint is ~2.6 MB which is above Next's fetch-cache limit,
 * so we cache the parsed result in-process with a manual TTL.
 */

const FPL_BASE = "https://fantasy.premierleague.com/api";
const BOOTSTRAP_TTL_MS = 6 * 60 * 60 * 1000; // 6h

type BootstrapTeam = {
  id: number;
  name: string;
  short_name: string;
};

type Bootstrap = {
  teams: BootstrapTeam[];
};

// Fallback list used if FPL is unreachable. Reflects the 2025/26 Premier
// League season. The cache layer treats FPL as the source of truth — this
// only kicks in on hard fetch failures.
const FALLBACK_TEAMS = [
  "Arsenal",
  "Aston Villa",
  "Bournemouth",
  "Brentford",
  "Brighton",
  "Burnley",
  "Chelsea",
  "Crystal Palace",
  "Everton",
  "Fulham",
  "Leeds",
  "Liverpool",
  "Man City",
  "Man Utd",
  "Newcastle",
  "Nott'm Forest",
  "Sunderland",
  "Tottenham",
  "West Ham",
  "Wolves",
];

let bootstrapCache: { data: Bootstrap; fetchedAt: number } | null = null;
let inflight: Promise<Bootstrap | null> | null = null;

async function fetchBootstrap(): Promise<Bootstrap | null> {
  if (
    bootstrapCache &&
    Date.now() - bootstrapCache.fetchedAt < BOOTSTRAP_TTL_MS
  ) {
    return bootstrapCache.data;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(`${FPL_BASE}/bootstrap-static/`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`FPL ${res.status}`);
      const data = (await res.json()) as Bootstrap;
      bootstrapCache = { data, fetchedAt: Date.now() };
      return data;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export async function getTeams(): Promise<string[]> {
  const data = await fetchBootstrap();
  if (!data) return [...FALLBACK_TEAMS].sort();
  return data.teams.map((t) => t.name).sort();
}
