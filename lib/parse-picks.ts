/**
 * Shared validation for a predictions payload. Used by both the Save
 * route (/api/predictions) and the Submit route.
 */

export type Pick = { matchIndex: number; home: number; away: number };

export function parsePicks(input: unknown): Pick[] | null {
  if (!Array.isArray(input)) return null;
  const out: Pick[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const matchIndex = r.matchIndex;
    const home = r.home;
    const away = r.away;
    if (
      !Number.isInteger(matchIndex) ||
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      (home as number) < 0 ||
      (away as number) < 0 ||
      (home as number) > 20 ||
      (away as number) > 20
    ) {
      return null;
    }
    out.push({
      matchIndex: matchIndex as number,
      home: home as number,
      away: away as number,
    });
  }
  return out;
}
