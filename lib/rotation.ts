/**
 * Rotation logic for who picks when and who can see whom.
 *
 * The base order is set once when a league locks (cron, first kickoff of
 * current_gw). For each GW thereafter, the rotation is the base order
 * rotated LEFT by (gw - 1) positions:
 *
 *   base_order = [A, B, C, D, E]
 *   GW 1 → [A, B, C, D, E]   A starts, no info
 *   GW 2 → [B, C, D, E, A]   B starts
 *   GW 6 → [A, B, C, D, E]   wraps around
 *
 * Visibility (during an open GW): you see picks from everyone above you
 * in this GW's rotation. The first picker sees no one.
 */

/**
 * Returns the rotation order for a given GW.
 *
 * Test cases:
 *   rotationForGw([A,B,C,D,E], 1) → [A,B,C,D,E]
 *   rotationForGw([A,B,C,D,E], 2) → [B,C,D,E,A]
 *   rotationForGw([A,B,C,D,E], 5) → [E,A,B,C,D]
 *   rotationForGw([A,B,C,D,E], 6) → [A,B,C,D,E]   (wraps via modulo)
 *   rotationForGw([A,B,C,D,E], 38) → [C,D,E,A,B]  (gw > n)
 *   rotationForGw([], 1) → []                     (empty base, e.g. unlocked league)
 */
export function rotationForGw(baseOrder: string[], gw: number): string[] {
  if (baseOrder.length === 0) return [];
  const n = baseOrder.length;
  const shift = (((gw - 1) % n) + n) % n;
  return [...baseOrder.slice(shift), ...baseOrder.slice(0, shift)];
}

/**
 * Returns the user IDs whose picks `me` is allowed to see during an open
 * gameweek — i.e. everyone above `me` in this week's rotation. The first
 * picker (and any user not in the rotation) sees no one.
 *
 * Callers should also add `me` to the visible set when fetching picks —
 * users always see their own picks regardless of rotation position.
 */
export function visibleUserIds(rotation: string[], me: string): string[] {
  const i = rotation.indexOf(me);
  if (i <= 0) return [];
  return rotation.slice(0, i);
}

/**
 * Whether the given user is first in this rotation.
 */
export function isStarter(rotation: string[], userId: string): boolean {
  return rotation.length > 0 && rotation[0] === userId;
}

/**
 * Three-letter abbreviation for a display name, used in the picks matrix
 * column headers. Strips non-letters, uppercases, takes the first three.
 * Short names degrade gracefully ("Jo" → "JO").
 */
export function abbreviateName(name: string): string {
  const clean = name.replace(/[^A-Za-z]/g, "").toUpperCase();
  return clean.slice(0, 3) || "—";
}
