/**
 * Headline templates for the gameweek Verdict. Plain copy — edit freely.
 *
 * Each template belongs to a SCENARIO. lib/verdict.ts classifies the
 * gameweek into one scenario, then picks a template from that bucket at
 * random and fills the {slots}.
 *
 * Slots available (only use ones relevant to the scenario):
 *   {top}        top scorer's name
 *   {topPts}     their gameweek points
 *   {topExacts}  their exact-score count
 *   {runnerUp}   second place's name
 *   {gap}        points gap, top vs runner-up
 *   {mover}      biggest climber's name
 *   {moverN}     places they climbed
 *   {blankHome}  home team of the fixture everyone got wrong
 *   {blankAway}  away team of that fixture
 */

export type VerdictScenario =
  | "everyone-blanked"
  | "exact-machine"
  | "runaway"
  | "tight"
  | "mover"
  | "low-week"
  | "generic";

export const VERDICT_TEMPLATES: Record<VerdictScenario, string[]> = {
  "everyone-blanked": [
    "Not one of you called {blankHome} vs {blankAway}. Football, eh.",
    "{blankHome} vs {blankAway} broke the whole league. Nobody saw that coming.",
    "A clean sweep of wrong on {blankHome} vs {blankAway}. Humbling.",
  ],
  "exact-machine": [
    "{top} called {topExacts} scores on the nose. The rest of you should be embarrassed.",
    "{topExacts} exacts for {top}. Either a genius or a cheat — jury's out.",
    "{top} was operating on a different frequency: {topExacts} exact scores.",
  ],
  runaway: [
    "{top} ran the table with {topPts} — {gap} clear of {runnerUp}. Not close.",
    "{top} put {topPts} on the board and left {runnerUp} {gap} behind.",
    "A {topPts}-point gameweek from {top}. {runnerUp} never stood a chance.",
  ],
  tight: [
    "{top} edges it on {topPts}, but {runnerUp} was right on their heels.",
    "Barely a cigarette paper between {top} and {runnerUp} this week.",
    "{top} top on {topPts} — but {runnerUp} will feel that one slip away.",
  ],
  mover: [
    "{mover} is the week's big climber, up {moverN} places. Eyes on the prize.",
    "{moverN} places gained for {mover}. Someone's found form.",
    "{mover} kicked the door in — up {moverN} this week.",
  ],
  "low-week": [
    "Grim viewing all round. {top} 'won' it on {topPts}.",
    "Nobody covered themselves in glory. {top} the least-bad on {topPts}.",
    "A gameweek to forget. {top} scraped top with {topPts}.",
  ],
  generic: [
    "{top} takes the gameweek on {topPts}.",
    "{topPts} points and the bragging rights go to {top}.",
    "{top} leads the way this week with {topPts}.",
  ],
};

export function fillTemplate(
  template: string,
  slots: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = slots[key];
    return v === undefined ? whole : String(v);
  });
}
