/**
 * Generate a friendly 6-char join code (lowercase a-z + 0-9).
 * 36^6 ≈ 2.2 billion combinations — collision risk is negligible for a
 * small private app. The caller should still retry on unique-constraint
 * conflict in the leagues table.
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
