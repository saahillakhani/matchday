/**
 * Team metadata for badge rendering — 3-letter code + brand colour.
 * Names match the FPL bootstrap-static `name` field. If FPL changes a name,
 * matching here falls through to UNKNOWN and the badge degrades gracefully.
 */

type TeamMeta = {
  code: string; // 3-letter short code (matches FPL short_name)
  color: string; // primary brand hex
};

const TEAMS: Record<string, TeamMeta> = {
  Arsenal: { code: "ARS", color: "#EF0107" },
  "Aston Villa": { code: "AVL", color: "#95BFE5" },
  Bournemouth: { code: "BOU", color: "#DA291C" },
  Brentford: { code: "BRE", color: "#E30613" },
  Brighton: { code: "BHA", color: "#0057B8" },
  Burnley: { code: "BUR", color: "#6C1D45" },
  Chelsea: { code: "CHE", color: "#034694" },
  "Crystal Palace": { code: "CRY", color: "#1B458F" },
  Everton: { code: "EVE", color: "#003399" },
  Fulham: { code: "FUL", color: "#000000" },
  Leeds: { code: "LEE", color: "#FFCD00" },
  "Leicester City": { code: "LEI", color: "#003090" },
  "Leicester": { code: "LEI", color: "#003090" },
  Liverpool: { code: "LIV", color: "#C8102E" },
  Luton: { code: "LUT", color: "#F78F1E" },
  "Man City": { code: "MCI", color: "#6CABDD" },
  "Manchester City": { code: "MCI", color: "#6CABDD" },
  "Man Utd": { code: "MUN", color: "#DA291C" },
  "Manchester United": { code: "MUN", color: "#DA291C" },
  Newcastle: { code: "NEW", color: "#241F20" },
  "Newcastle United": { code: "NEW", color: "#241F20" },
  "Nott'm Forest": { code: "NFO", color: "#DD0000" },
  "Nottingham Forest": { code: "NFO", color: "#DD0000" },
  "Sheffield Utd": { code: "SHU", color: "#EE2737" },
  Southampton: { code: "SOU", color: "#D71920" },
  Sunderland: { code: "SUN", color: "#EB172B" },
  Spurs: { code: "TOT", color: "#132257" },
  Tottenham: { code: "TOT", color: "#132257" },
  "Tottenham Hotspur": { code: "TOT", color: "#132257" },
  "West Ham": { code: "WHU", color: "#7A263A" },
  "West Ham United": { code: "WHU", color: "#7A263A" },
  Wolves: { code: "WOL", color: "#FDB913" },
  "Wolverhampton Wanderers": { code: "WOL", color: "#FDB913" },
};

const UNKNOWN: TeamMeta = { code: "—", color: "#888888" };

export function teamMeta(name: string): TeamMeta {
  return TEAMS[name] ?? UNKNOWN;
}

export function teamCode(name: string): string {
  return teamMeta(name).code;
}

export function teamColor(name: string): string {
  return teamMeta(name).color;
}
