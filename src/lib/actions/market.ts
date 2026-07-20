"use server";

import { revalidatePath } from "next/cache";
import { fetchIneBenchmarks } from "@/lib/ine";
import { fail, requireAdmin, type ActionResult } from "./util";

export interface BenchmarkInput {
  dicofre: string;
  parish_name?: string | null;
  municipality?: string | null;
  period: string; // ex.: '2025S2'
  rent_median_m2?: number | null;
  sale_median_m2?: number | null;
  level: "freguesia" | "concelho";
  source?: string;
}

/** Insere/atualiza um benchmark (manual ou importado). */
export async function saveBenchmark(input: BenchmarkInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("market_benchmarks").upsert(
      {
        dicofre: input.dicofre.trim(),
        parish_name: input.parish_name || null,
        municipality: input.municipality || null,
        period: input.period.trim(),
        rent_median_m2: input.rent_median_m2 ?? null,
        sale_median_m2: input.sale_median_m2 ?? null,
        level: input.level,
        source: input.source ?? "manual",
      },
      { onConflict: "dicofre,period,source" },
    );
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Import em lote (ficheiro do INE convertido em linhas no browser). */
export async function importBenchmarks(rows: BenchmarkInput[]): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    if (rows.length === 0) return { ok: false, error: "Sem linhas para importar." };
    const clean = rows
      .filter((r) => r.dicofre && r.period)
      .map((r) => ({
        dicofre: r.dicofre.trim(),
        parish_name: r.parish_name || null,
        municipality: r.municipality || null,
        period: r.period.trim(),
        rent_median_m2: r.rent_median_m2 ?? null,
        sale_median_m2: r.sale_median_m2 ?? null,
        level: r.level,
        source: r.source ?? "ine",
      }));
    const { error, data } = await supabase
      .from("market_benchmarks")
      .upsert(clean, { onConflict: "dicofre,period,source" })
      .select("id");
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true, info: `${data?.length ?? 0} benchmarks gravados.` };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Vai buscar ao INE as medianas mais recentes (rendas €/m² e vendas €/m²,
 * municípios + freguesias) e grava-as em market_benchmarks.
 */
export async function refreshIne(): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { rent, sale } = await fetchIneBenchmarks();

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
      })),
    );

    revalidatePath("/", "layout");
    return {
      ok: true,
      info:
        `Rendas ${rent.periodLabel}: ${rent.rows.length} territórios · ` +
        `Vendas ${sale.periodLabel}: ${sale.rows.length} territórios.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBenchmark(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("market_benchmarks").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
