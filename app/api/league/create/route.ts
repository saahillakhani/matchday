import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCode } from "@/lib/league-code";

type CreatePayload = {
  name?: unknown;
  selectedTeams?: unknown;
};

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreatePayload;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const teams = Array.isArray(body.selectedTeams)
    ? body.selectedTeams.filter((t): t is string => typeof t === "string")
    : [];

  if (!name) {
    return NextResponse.json(
      { error: "League name is required" },
      { status: 400 },
    );
  }
  if (teams.length !== 6) {
    return NextResponse.json(
      { error: "Pick exactly 6 teams" },
      { status: 400 },
    );
  }

  // Insert league. Retry on unique-code conflict (extremely rare).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data: league, error } = await supabase
      .from("leagues")
      .insert({
        name,
        code,
        selected_teams: teams,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation
      if ((error as { code?: string }).code === "23505") continue;
      console.error("[league/create] league insert failed:", error);
      return NextResponse.json(
        { error: `Insert leagues: ${error.message}` },
        { status: 500 },
      );
    }

    const { error: memberError } = await supabase
      .from("league_members")
      .insert({ league_id: league.id, user_id: user.id });

    if (memberError) {
      console.error("[league/create] member insert failed:", memberError);
      return NextResponse.json(
        { error: `Insert membership: ${memberError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ league });
  }

  return NextResponse.json(
    { error: "Could not generate a unique join code, try again" },
    { status: 500 },
  );
}
