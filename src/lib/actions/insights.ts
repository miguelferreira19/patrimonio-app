"use server";

// Adiar e dispensar decisões da fila do Agora (PLANO.md §4, S3).
//
// A fila é recalculada a cada request a partir do snapshot, logo "já tratei disto" tem
// de viver na BD ou não sobrevive a um F5. O gerador continua a correr — isto só decide
// se o item se MOSTRA. Nada aqui apaga um facto.

import { revalidatePath } from "next/cache";
import { ADIAR_DIAS } from "../insight-prazo";
import { fail, requireAdmin, type ActionResult } from "./util";

// Um ficheiro "use server" só pode exportar funções async, por isso a constante vive em
// lib/insight-prazo.ts e não aqui — é importada pelos dois lados.

function refresh() {
  revalidatePath("/", "layout");
}

export async function snoozeInsight(input: {
  kind: string;
  subject?: string;
  dias?: number;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const ate = new Date();
    ate.setDate(ate.getDate() + (input.dias ?? ADIAR_DIAS));
    const { error } = await supabase.from("insight_state").upsert(
      {
        kind: input.kind,
        subject: input.subject ?? "",
        snoozed_until: ate.toISOString().slice(0, 10),
        dismissed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "kind,subject" },
    );
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, info: `Adiado até ${ate.toLocaleDateString("pt-PT")}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function dismissInsight(input: {
  kind: string;
  subject?: string;
  note?: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("insight_state").upsert(
      {
        kind: input.kind,
        subject: input.subject ?? "",
        snoozed_until: null,
        dismissed_at: new Date().toISOString(),
        note: input.note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "kind,subject" },
    );
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, info: "Dispensado. Volta a aparecer se o reativares." };
  } catch (e) {
    return fail(e);
  }
}

/** Anula um adiar/dispensar. É o que torna as duas ações acima reversíveis, e é por isso
 *  que elas podem ser um clique só, sem confirmação. */
export async function restoreInsight(input: {
  kind: string;
  subject?: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("insight_state")
      .delete()
      .eq("kind", input.kind)
      .eq("subject", input.subject ?? "");
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, info: "Reposto na fila." };
  } catch (e) {
    return fail(e);
  }
}
