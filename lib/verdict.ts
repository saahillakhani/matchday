/**
 * The Verdict — a deterministic, rule-based gameweek recap. No AI: it
 * classifies the gameweek into a scenario and fills a cheeky headline
 * template (see lib/verdict-templates.ts), plus surfaces the top scorer
 * and the best/worst single picks.
 */

import { aggregate, scorePick } from "./scoring";
import { computeStandings, type Member, type RawPick, type RawResult } from "./standings";
import {
  fillTemplate,
  VERDICT_TEMPLATES,
  type VerdictScenario,
} from "./verdict-templates";

type Fixture = {
  matchIndex: number;
  homeTeam: string;
  awayTeam: string;
};

export type Verdict = {
  gw: number;
  headline: string;
  topOfGw: { name: string; points: number; exacts: number } | null;
  bestPick: { name: string; scoreline: string; fixture: string } | null;
  worstPick: {
    name: string;
    predicted: string;
    actual: string;
    fixture: string;
  } | null;
};

export function buildVerdict(input: {
  members: Member[];
  picks: RawPick[];
  results: RawResult[];
  fixtures: Fixture[];
  gw: number;
}): Verdict | null {
  const { members, picks, results, fixtures, gw } = input;

  const gwResults = results.filter((r) => r.gw === gw);
  if (gwResults.length === 0 || members.length === 0) return null;

  const resultByIdx = new Map(
    gwResults.map((r) => [r.matchIndex, { home: r.home, away: r.away }]),
  );
  const fixtureByIdx = new Map(fixtures.map((f) => [f.matchIndex, f]));

  // Each player's picks for this GW.
  const picksByUser = new Map<
    string,
    Map<number, { home: number; away: number }>
  >();
  for (const p of picks) {
    if (p.gw !== gw) continue;
    let m = picksByUser.get(p.userId);
    if (!m) {
      m = new Map();
      picksByUser.set(p.userId, m);
    }
    m.set(p.matchIndex, { home: p.home, away: p.away });
  }

  // Per-player GW aggregate, plus collect every scored pick for the
  // best/worst-pick signals.
  type ScoredPick = {
    name: string;
    matchIndex: number;
    pick: { home: number; away: number };
    actual: { home: number; away: number };
    label: string;
  };
  const allScored: ScoredPick[] = [];
  const perPlayer = members.map((mem) => {
    const userPicks = picksByUser.get(mem.userId);
    const outcomes = [];
    for (const [idx, actual] of resultByIdx) {
      const pick = userPicks?.get(idx) ?? null;
      const outcome = scorePick(pick, actual);
      outcomes.push(outcome);
      if (pick) {
        allScored.push({
          name: mem.displayName,
          matchIndex: idx,
          pick,
          actual,
          label: outcome.label,
        });
      }
    }
    const agg = aggregate(outcomes);
    return { ...mem, ...agg };
  });

  const ranked = [...perPlayer].sort(
    (a, b) =>
      b.points - a.points ||
      b.exacts - a.exacts ||
      b.bonus - a.bonus ||
      a.displayName.localeCompare(b.displayName),
  );
  const top = ranked[0] ?? null;
  const runner = ranked[1] ?? null;
  if (!top) return null;

  // Best pick: hardest exact (most goals in the actual scoreline).
  const exacts = allScored.filter((s) => s.label === "EXACT");
  exacts.sort(
    (a, b) =>
      b.actual.home + b.actual.away - (a.actual.home + a.actual.away),
  );
  const best = exacts[0] ?? null;

  // Worst pick: biggest distance between prediction and reality.
  const dist = (s: ScoredPick) =>
    Math.abs(s.pick.home - s.actual.home) +
    Math.abs(s.pick.away - s.actual.away);
  const sortedByDist = [...allScored].sort((a, b) => dist(b) - dist(a));
  const worst = sortedByDist[0] ?? null;

  // A fixture nobody got points on (≥2 players picked it).
  let blankFixture: Fixture | null = null;
  for (const [idx] of resultByIdx) {
    const picksOnIt = allScored.filter((s) => s.matchIndex === idx);
    if (
      picksOnIt.length >= 2 &&
      picksOnIt.every((s) => s.label === "0" || s.label === "BONUS")
    ) {
      blankFixture = fixtureByIdx.get(idx) ?? null;
      if (blankFixture) break;
    }
  }

  // Biggest climber, comparing the table before vs after this GW.
  const before = computeStandings({
    members,
    picks,
    results: results.filter((r) => r.gw < gw),
  }).rankedOrder;
  const after = computeStandings({
    members,
    picks,
    results: results.filter((r) => r.gw <= gw),
  }).rankedOrder;
  let mover: { name: string; places: number } | null = null;
  if (before.length > 0) {
    for (const mem of members) {
      const wasAt = before.indexOf(mem.userId);
      const nowAt = after.indexOf(mem.userId);
      if (wasAt < 0 || nowAt < 0) continue;
      const places = wasAt - nowAt; // positive = climbed
      if (places >= 1 && (!mover || places > mover.places)) {
        mover = { name: mem.displayName, places };
      }
    }
  }

  // Classify the gameweek, most interesting first.
  const gap = runner ? top.points - runner.points : top.points;
  let scenario: VerdictScenario;
  if (blankFixture) {
    scenario = "everyone-blanked";
  } else if (top.exacts >= 2) {
    scenario = "exact-machine";
  } else if (runner && gap >= 5) {
    scenario = "runaway";
  } else if (runner && gap <= 1 && top.points > 0) {
    scenario = "tight";
  } else if (mover && mover.places >= 2) {
    scenario = "mover";
  } else if (top.points <= 2) {
    scenario = "low-week";
  } else {
    scenario = "generic";
  }

  const bucket = VERDICT_TEMPLATES[scenario];
  const template = bucket[Math.floor(Math.random() * bucket.length)];
  const headline = fillTemplate(template, {
    top: top.displayName,
    topPts: top.points,
    topExacts: top.exacts,
    runnerUp: runner?.displayName ?? "",
    gap,
    mover: mover?.name ?? "",
    moverN: mover?.places ?? "",
    blankHome: blankFixture?.homeTeam ?? "",
    blankAway: blankFixture?.awayTeam ?? "",
  });

  const fixtureName = (idx: number) => {
    const f = fixtureByIdx.get(idx);
    return f ? `${f.homeTeam} v ${f.awayTeam}` : "—";
  };

  return {
    gw,
    headline,
    topOfGw: { name: top.displayName, points: top.points, exacts: top.exacts },
    bestPick: best
      ? {
          name: best.name,
          scoreline: `${best.actual.home}–${best.actual.away}`,
          fixture: fixtureName(best.matchIndex),
        }
      : null,
    worstPick: worst
      ? {
          name: worst.name,
          predicted: `${worst.pick.home}–${worst.pick.away}`,
          actual: `${worst.actual.home}–${worst.actual.away}`,
          fixture: fixtureName(worst.matchIndex),
        }
      : null,
  };
}
