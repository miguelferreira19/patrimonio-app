"use server";

import { revalidatePath } from "next/cache";
import { runIneRefresh } from "@/lib/ine-refresh";
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

export async function refreshIne(): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { info } = await runIneRefresh(supabase);
    revalidatePath("/", "layout");
    return { ok: true, info };
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
