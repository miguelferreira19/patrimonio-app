"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { todayISO } from "../format";
import { linha } from "../supabase/dados";
import { exigir, validarRegistoNoDiario } from "../validar";
import { requireGestor, fail, type ActionResult } from "./util";

type Supabase = Awaited<ReturnType<typeof requireGestor>>["supabase"];

function pedidoDoCaso(requestId: string): string {
  const h = createHash("sha256").update(`diario:cobranca:${requestId.toLowerCase()}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function casoDeCobranca(supabase: Supabase, contractId: string, requestId: string, autor: string) {
  const contrato = linha<{ property_id: string }>(await supabase.from("contracts")
    .select("property_id").eq("id", contractId).maybeSingle(), "contracts");
  exigir(contrato, "Contrato inexistente.");
  const aberto = linha<{ id: string }>(await supabase.from("management_cases").select("id")
    .eq("contract_id", contractId).eq("kind", "cobranca").neq("status", "concluido")
    .order("id").limit(1).maybeSingle(), "management_cases");
  if (aberto) return aberto.id;
  const request_id = pedidoDoCaso(requestId);
  const result = await supabase.from("management_cases").upsert({
    kind: "cobranca", title: "Cobrança", status: "aberto", priority: "normal",
    contract_id: contractId, property_id: contrato.property_id, request_id, created_by: autor,
  }, { onConflict: "request_id", ignoreDuplicates: true });
  if (result.error) throw new Error(result.error.message);
  const caso = linha<{ id: string }>(await supabase.from("management_cases").select("id")
    .eq("request_id", request_id).maybeSingle(), "management_cases");
  exigir(caso, "Não foi possível abrir o caso de cobrança.");
  return caso.id;
}

export async function registarNoDiario(input: {
  contractId: string; kind: "contacto" | "promessa" | "carta" | "nota";
  note: string; occurredOn: string; dueDate?: string; amount?: number; requestId: string;
}): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireGestor();
    const validado = validarRegistoNoDiario(input, todayISO());
    const case_id = await casoDeCobranca(supabase, input.contractId, input.requestId, user.id);
    const { data, error } = await supabase.rpc("gestao_save_event", { p_input: {
      case_id, kind: input.kind, occurred_on: input.occurredOn, note: validado.note,
      due_date: input.kind === "promessa" ? input.dueDate : null,
      amount: validado.amount ?? null, request_id: input.requestId,
    } });
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true, id: data as string };
  } catch (error) {
    return fail(error);
  }
}
