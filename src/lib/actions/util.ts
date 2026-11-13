import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export type ActionResult = { ok: true; id?: string; info?: string } | { ok: false; error: string };

async function exigirPapel(permitidos: readonly Role[], recusa: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada, volta a entrar.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = permitidos.find((papel) => papel === profile?.role);
  if (!role) throw new Error(recusa);
  return { supabase, user, role };
}

export async function requireAdmin() {
  return exigirPapel(["admin"], "Apenas o administrador pode alterar dados.");
}

export async function requireGestor() {
  return exigirPapel(["admin", "gestor"], "Só o administrador ou um gestor podem registar isto.");
}

export function fail(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : String(e);
  return { ok: false, error: msg };
}
