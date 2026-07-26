"use server";

// O que sobrou do import da V1.
//
// As três ações de importação por lotes (`importReceiptsChunk`, `importContractsChunk`,
// `importPatrimonioChunk`, ~570 linhas) foram APAGADAS na Fase 6 com o wizard que as
// chamava. Escreviam sem diff e, pior, criavam frações e contratos sozinhas a partir do
// que estivesse no ficheiro — uma matriz mal lida virava uma fração nova. O caminho novo
// (`actions/importar.ts`) mostra o plano primeiro, só insere, e nunca inventa entidades.
//
// Ficou `syncContractRents`, que não é import: alinha `contracts.rent` com os recibos e é
// chamada pelo botão do Admin. O travão dela vive no SQL (fim do schema.sql).

import { revalidatePath } from "next/cache";
import { fail, requireAdmin, type ActionResult } from "./util";

export async function syncContractRents(): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.rpc("sync_contract_rents");
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true, info: `${data ?? 0} contratos com renda atualizada.` };
  } catch (e) {
    return fail(e);
  }
}

/** Linha da lista de contratos do Portal das Finanças, já normalizada pelo wizard. */
