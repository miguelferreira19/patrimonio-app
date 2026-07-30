"use server";

import { revalidatePath } from "next/cache";
import { BUCKET } from "@/lib/documentos";
import { fail, requireAdmin, type ActionResult } from "./util";

// O UPLOAD não passa por aqui de propósito: vai direto do browser para o Storage
// (`components/documentos/carregar.tsx`). Uma server action recebe o ficheiro inteiro no
// corpo do pedido e o Next corta em 1 MB por defeito — um contrato digitalizado passa
// disso à vontade, e o erro que se vê é "Body exceeded limit", que não ajuda ninguém.
// A escrita continua fechada: a política `documentos_insert` exige `public.is_admin()`,
// portanto quem não é admin leva 403 do próprio Supabase.

export async function apagarDocumento(path: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw new Error(error.message);
    revalidatePath("/documentos");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
// ponytail: não há "mover de fração". Arquivar no sítio errado corrige-se apagando e
// voltando a largar o ficheiro, e o palpite do nome acerta nas cadernetas, que são o lote
// grande. Se der trabalho a sério, `storage.move(origem, destino)` é uma linha.
