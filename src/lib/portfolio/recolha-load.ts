import type { SupabaseClient } from "@supabase/supabase-js";
import { linhas } from "../supabase/dados";
import type { CorridaDaRecolha } from "./recolha";

export async function carregarCorridasDaRecolha(supabase: SupabaseClient): Promise<CorridaDaRecolha[]> {
  const resultado = await supabase.from("collection_runs")
    .select("account,finished_at,started_at,ok")
    .order("started_at", { ascending: false }).limit(20);
  if (resultado.error && ["42P01", "PGRST205"].includes(resultado.error.code)) return [];
  return linhas<CorridaDaRecolha>(resultado, "collection_runs");
}
