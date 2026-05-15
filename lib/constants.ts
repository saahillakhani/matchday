/**
 * Project-wide tunables. Keep this small and obvious.
 */

/**
 * Maximum members in a single league. Rotation gameplay degrades as the
 * roster grows — by N=12 the back of the queue sees too much information,
 * and slow submitters block everyone behind them. 10 is the cap.
 */
export const MAX_LEAGUE_SIZE = 10;
