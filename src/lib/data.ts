import { createClient } from "./supabase/server";
import type { Role } from "./types";

/** Sessão + papel do utilizador atual (para uso nas páginas server). */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: Role = "viewer";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role === "admin") role = "admin";
  }
  return { supabase, user, role, isAdmin: role === "admin" };
}
