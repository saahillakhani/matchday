/**
 * Paginated fetch of all predictions for a league. Supabase REST has a
 * hard 1000-row cap per request (and `.limit()` doesn't bypass it), so
 * we walk the table in 1000-row chunks until we've drained it.
 *
 * Used by the Table, Form Grid, Profile, and /you pages — each needs the
 * full set to score across every member and gameweek.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const PAGE = 1000;

export type PredictionRow = {
  user_id: string | null;
  gw: number;
  match_index: number;
  home_score: number | null;
  away_score: number | null;
};

export async function fetchAllPredictions(
  supabase: SupabaseClient<Database>,
  leagueId: string,
): Promise<PredictionRow[]> {
  const all: PredictionRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("predictions")
      .select("user_id, gw, match_index, home_score, away_score")
      .eq("league_id", leagueId)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      throw new Error(`Failed to fetch predictions: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
