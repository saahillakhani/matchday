/**
 * Fisher-Yates shuffle, returning a new array. Used to randomise the
 * rotation base_order when a league locks.
 *
 * Math.random is fine here — base_order is for fairness in a hobby
 * league, not cryptographic. If we ever need reproducibility (e.g. the
 * sim harness), pass a seeded RNG via the optional second argument.
 */
export function fisherYatesShuffle<T>(
  input: readonly T[],
  rand: () => number = Math.random,
): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
