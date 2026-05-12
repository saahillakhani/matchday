import type { SupabaseClient } from "@supabase/supabase-js";

export type LeagueLookup = {
  id: string;
  name: string;
  locked: boolean;
};

/**
 * Wrapper around the get_league_by_code RPC. The RPC is hand-written
 * (added in migration 0003) and the generated database types will pick
 * it up after the next `supabase gen types` run. Until then we keep the
 * cast contained to this single helper.
 */
export async function getLeagueByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<{ league: LeagueLookup | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_league_by_code", {
    p_code: code,
  });
  if (error) return { league: null, error: error.message };
  const row = (data as LeagueLookup[] | null)?.[0] ?? null;
  return { league: row, error: null };
}
