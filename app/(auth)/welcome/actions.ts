"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateDisplayName(formData: FormData) {
  const raw = String(formData.get("displayName") ?? "").trim();
  const displayName = raw.slice(0, 30);
  if (!displayName) redirect("/welcome");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  redirect("/");
}
