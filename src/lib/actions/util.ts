import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; id?: string; info?: string } | { ok: false; error: string };

/** Garante sessão de admin; devolve o cliente Supabase autenticado. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada — volta a entrar.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    throw new Error("Apenas o administrador pode alterar dados.");
  }
  return { supabase, user };
}

export function fail(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : String(e);
  return { ok: false, error: msg };
}
