import { atrasoDeEmissao, sinais } from "@/lib/controlo";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { carregarFontesDoDiario } from "@/lib/portfolio/diario-load";
import { diarioDoInquilino } from "@/lib/portfolio/diario";
import { devedores } from "@/lib/portfolio/inquilinos";
import type { Observacao } from "@/lib/controlo";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contextoDoControlo } from "./modelo";

export async function carregarControlo(supabase: SupabaseClient, observacoes: Observacao[]) {
  const { snap, raw } = await getSnapshotComRaw();
  const ids = raw.contracts.map((c) => c.id);
  const fontes = await carregarFontesDoDiario(supabase, ids);
  const contexto = contextoDoControlo(raw.contracts, raw.rentUpdates, devedores(snap),
    diarioDoInquilino(ids, fontes), snap.hoje);
  return { sinais: sinais(observacoes, contexto), emissao: atrasoDeEmissao(observacoes),
    contratos: raw.contracts, estados: raw.insightState };
}
