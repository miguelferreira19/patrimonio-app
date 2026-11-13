import { cache } from "react";
import type { getSession } from "../data";
import { paginateAll } from "../paginate";
import { linhas } from "../supabase/dados";
import type { CasoAberto, DespesaAnual, EntradaDeProblemas } from "./problemas";
import type { Snapshot } from "./snapshot";

type Cliente = Awaited<ReturnType<typeof getSession>>["supabase"];

export const carregarEntradaDeProblemas = cache(async (
  supabase: Cliente, snap: Snapshot, hoje: string,
): Promise<EntradaDeProblemas> => {
  const ano = Number(hoje.slice(0, 4));
  const [casos, despesas] = await Promise.all([
    paginateAll<CasoAberto>(async (de, ate) => linhas<CasoAberto>(
      await supabase.from("management_cases")
        .select("id,property_id,kind,status,priority,title")
        .eq("kind", "manutencao").neq("status", "concluido")
        .order("id").range(de, ate), "management_cases",
    )),
    // O problema anual compara o último ano fechado com o anterior.
    paginateAll<DespesaAnual>(async (de, ate) => linhas<DespesaAnual>(
      await supabase.from("expenses").select("*")
        .gte("expense_date", `${ano - 2}-01-01`).lt("expense_date", `${ano}-01-01`)
        .order("id").range(de, ate), "expenses",
    )),
  ]);
  return { snap, casos, despesas, hoje };
});
