import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "./form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { leagueId?: string };
}) {
  const leagueId = searchParams.leagueId;
  if (!leagueId) redirect("/");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, code, created_by, current_gw, locked")
    .eq("id", leagueId)
    .single();
  if (!league) redirect("/");

  type MemberRow = {
    user_id: string | null;
    profiles: { display_name: string } | null;
  };

  const { data: membersData } = await supabase
    .from("league_members")
    .select("user_id, profiles(display_name)")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });

  const members = ((membersData ?? []) as MemberRow[])
    .filter((m): m is MemberRow & { user_id: string } => !!m.user_id)
    .map((m) => ({
      userId: m.user_id,
      displayName: m.profiles?.display_name ?? "—",
    }));

  return (
    <SettingsView
      leagueId={league.id}
      leagueName={league.name}
      leagueCode={league.code}
      locked={league.locked}
      isCreator={league.created_by === user.id}
      members={members}
    />
  );
}
