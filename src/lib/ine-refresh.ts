// O refresh dos benchmarks do INE, partilhado pelo botão do Admin e pelo cron mensal.
//
// Vive FORA de `lib/actions/market.ts` de propósito (2026-10-03): num ficheiro
// `"use server"` todas as exportações viram endpoints de action chamáveis por POST, e este
// é o núcleo que, no cron, escreve com a service-role key. Não é uma action: é uma função
// que recebe um cliente já autorizado.

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchIneBenchmarks } from "./ine";

/**
 * Vai buscar ao INE as medianas mais recentes (rendas €/m² e vendas €/m²,
 * municípios + freguesias) e grava-as em market_benchmarks.
 *
 * Núcleo puro-de-permissões: recebe o cliente já autorizado a escrever (admin via cookies,
 * ou service-role no cron — ver src/app/api/cron/ine/route.ts) em vez de o resolver aqui,
 * para poder ser chamado tanto pela action do botão como pela rota de cron.
 */
export async function runIneRefresh(supabase: SupabaseClient): Promise<{ info: string }> {
  const { rent, sale } = await fetchIneBenchmarks();
  // `fetched_at` vai explícito: o default da coluna só corre no INSERT, e num upsert que
  // atualiza a linha ficava a data da PRIMEIRA importação. O painel do Admin dizia
  // "atualizado em julho" mesmo depois de o cron correr em outubro.
  const agora = new Date().toISOString();

  async function upsertChunked(rows: Array<Record<string, unknown>>) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase
        .from("market_benchmarks")
        .upsert(rows.slice(i, i + 500), { onConflict: "dicofre,period,source" });
      if (error) throw new Error(error.message);
    }
  }

  await upsertChunked(
    rent.rows.map((r) => ({
      dicofre: r.code,
      parish_name: r.level === "freguesia" ? r.name : null,
      municipality: r.municipality,
      period: rent.period,
      rent_median_m2: r.value,
      level: r.level,
      source: "ine",
      fetched_at: agora,
    })),
  );
  await upsertChunked(
    sale.rows.map((r) => ({
      dicofre: r.code,
      parish_name: r.level === "freguesia" ? r.name : null,
      municipality: r.municipality,
      period: sale.period,
      sale_median_m2: r.value,
      level: r.level,
      source: "ine",
      fetched_at: agora,
    })),
  );

  return {
    info:
      `Rendas ${rent.periodLabel}: ${rent.rows.length} territórios · ` +
      `Vendas ${sale.periodLabel}: ${sale.rows.length} territórios.`,
  };
}
