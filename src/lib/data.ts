import { createClient } from "./supabase/server";
import { paginateAll } from "./paginate";
import type { Payment, Role } from "./types";

/** TODOS os pagamentos da carteira, paginados para não perder linhas ao max-rows do Supabase
 *  (~1000, mesmo com .limit() alto — sem isto contratos inteiros somem e aparecem como "nunca").
 *  Histórico COMPLETO: usado por Atrasos e pelo dashboard, que partilham a mesma computeArrears.
 *  Ordem por (contract_id, ref_month) = chave única, para as páginas não saltarem nem repetirem. */
export async function fetchAllPayments(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Payment[]> {
  return paginateAll<Payment>(async (from, to) => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("contract_id", { ascending: true })
      .order("ref_month", { ascending: true })
      .range(from, to);
    if (error) throw error;
    return (data ?? []) as Payment[];
  });
}

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
