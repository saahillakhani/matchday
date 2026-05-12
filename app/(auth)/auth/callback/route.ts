import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLeagueByCode } from "@/lib/league-lookup";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error.message)}`,
    );
  }

  // If the visitor landed on /join?code=… while signed out, they have a
  // pending join cookie. Honour it now and clean it up.
  const cookieStore = cookies();
  const pendingCode = cookieStore.get("pendingLeagueCode")?.value;
  if (pendingCode) {
    cookieStore.delete("pendingLeagueCode");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { league } = await getLeagueByCode(supabase, pendingCode);
      if (league && !league.locked) {
        // 23505 = already a member; silently ignore.
        await supabase
          .from("league_members")
          .insert({ league_id: league.id, user_id: user.id });
      }
    }
  }

  return NextResponse.redirect(`${origin}/welcome`);
}
