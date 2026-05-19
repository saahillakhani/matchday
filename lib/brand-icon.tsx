import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactElement } from "react";

/**
 * Fraunces 600 (display cut) as a raw TrueType buffer — the brand serif,
 * fed to next/og's ImageResponse so the generated icons render in the
 * same typeface as the site. Read at build time when the icons prerender.
 */
export async function frauncesFont() {
  return readFile(join(process.cwd(), "lib/assets/fraunces-600.ttf"));
}

/** The Matchday monogram: a serif "M" centred on the cream brand background. */
export function MatchdayMark({
  dim,
  scale,
}: {
  dim: number;
  scale: number;
}): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F2EDE4",
        color: "#0A0A0A",
        fontFamily: "Fraunces",
        fontWeight: 600,
        fontSize: dim * scale,
        lineHeight: 1,
      }}
    >
      M
    </div>
  );
}
