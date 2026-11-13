import type { SupabaseClient } from "@supabase/supabase-js";
import { paginateAll } from "../paginate";
import { linhas } from "../supabase/dados";
import type { FontesDoDiario } from "./diario";

type Caso = { id: string; contract_id: string | null };
type Evento = Omit<FontesDoDiario["eventos"][number], "contract_id" | "autor"> & {
  case_id: string; created_by: string | null;
};
type Movimento = Omit<FontesDoDiario["movimentos"][number], "autor"> & { created_by: string | null };
type Perfil = { id: string; display_name: string | null; email: string | null };
type Filtro = { coluna: string; ids: string[] };

function ler<T>(supabase: SupabaseClient, tabela: string, filtro?: Filtro): Promise<T[]> {
  if (filtro && filtro.ids.length === 0) return Promise.resolve([]);
  return paginateAll<T>(async (inicio, fim) => {
    let query = supabase.from(tabela).select("*");
    if (filtro) query = query.in(filtro.coluna, filtro.ids);
    return linhas<T>(await query.order("id").range(inicio, fim), tabela);
  });
}

export async function carregarFontesDoDiario(
  supabase: SupabaseClient, contratoIds?: string[],
): Promise<FontesDoDiario> {
  if (contratoIds?.length === 0) return { eventos: [], movimentos: [], recibos: [] };
  const filtro = contratoIds ? { coluna: "contract_id", ids: contratoIds } : undefined;
  const [casos, movimentos, recibos] = await Promise.all([
    ler<Caso>(supabase, "management_cases", filtro),
    ler<Movimento>(supabase, "payment_movements", filtro),
    filtro ? ler<FontesDoDiario["recibos"][number]>(supabase, "receipts", filtro) : Promise.resolve([]),
  ]);
  const contratoDoCaso = new Map(casos.map((c) => [c.id, c.contract_id]));
  const eventos = (await ler<Evento>(supabase, "management_events",
    contratoIds ? { coluna: "case_id", ids: casos.map((c) => c.id) } : undefined))
    .filter((e) => contratoDoCaso.get(e.case_id));
  const autores = [...new Set([...eventos, ...movimentos].flatMap((e) => e.created_by ? [e.created_by] : []))];
  const perfis = await ler<Perfil>(supabase, "profiles", { coluna: "id", ids: autores });
  const nomes = new Map(perfis.map((p) => [p.id, p.display_name?.trim() || p.email?.split("@")[0] || null]));
  const autor = (id: string | null) => id ? nomes.get(id) ?? null : null;
  return {
    eventos: eventos.map((e) => ({
      ...e, contract_id: contratoDoCaso.get(e.case_id)!, autor: autor(e.created_by),
    })),
    movimentos: movimentos.map((m) => ({ ...m, autor: autor(m.created_by) })),
    recibos,
  };
}
