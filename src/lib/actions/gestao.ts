"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, fail, type ActionResult } from "./util";
import { eData, eNumero, exigir } from "../validar";
import { parseAllocations, receiptCandidates, validMonth, type ManagementCase } from "../gestao";
import { linhas } from "../supabase/dados";
import { BUCKET, escopoSeguro } from "../documentos";
import { todayISO } from "../format";
import type { Contract, Receipt } from "../types";

const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
function refresh() {
  revalidatePath("/", "layout");
}
async function checkDocuments(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  propertyId: string,
  paths: string[],
) {
  exigir(paths.length <= 30, "Cada ocorrência aceita até 30 documentos.");
  if (!paths.length) return;
  const q = await supabase.from("properties").select("matriz_article").eq("id", propertyId).single();
  if (q.error || !q.data) throw new Error("Imóvel inexistente.");
  const prefix = escopoSeguro(q.data.matriz_article || propertyId) + "__";
  for (const path of paths) {
    exigir(
      path.startsWith(prefix) && /^[A-Za-z0-9._-]+$/.test(path) && !path.includes(".."),
      "O documento deve estar no arquivo deste imóvel.",
    );
    const { data, error } = await supabase.storage.from(BUCKET).list("", { search: path, limit: 10 });
    if (error) throw new Error("Não foi possível verificar o documento no arquivo.");
    exigir(
      data?.some((item) => item.name === path),
      "O documento indicado não existe no arquivo.",
    );
  }
}
export async function savePayment(input: {
  contract_id: string;
  amount: number;
  received_date: string;
  method: string;
  reference?: string;
  proof_path?: string;
  notes?: string;
  allocation_text: string;
  request_id: string;
  receipt_ids?: string[];
  replaces_id?: string;
  correction_reason?: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(
      uuid(input.contract_id) && uuid(input.request_id),
      "Contrato ou identificação da operação inválidos.",
    );
    exigir(eData(input.received_date), "Indica a data real do pagamento.");
    exigir(
      input.received_date <= todayISO(),
      "A data de um pagamento recebido não pode ser futura. Reparte adiantamentos pelos meses futuros na repartição.",
    );
    exigir(["transferencia", "dinheiro", "outro"].includes(input.method), "Método inválido.");
    exigir(
      (input.reference?.length ?? 0) <= 200 && (input.notes?.length ?? 0) <= 5000,
      "A referência ou nota excede o tamanho permitido.",
    );
    const allocations = parseAllocations(input.allocation_text, input.amount);
    const receipt_ids = [...new Set(input.receipt_ids ?? [])];
    exigir(receipt_ids.length <= 500 && receipt_ids.every(uuid), "Lista de recibos inválida.");
    const cq = await supabase.from("contracts").select("property_id").eq("id", input.contract_id).single();
    exigir(!cq.error && cq.data, "Contrato inexistente.");
    await checkDocuments(supabase, cq.data.property_id, input.proof_path ? [input.proof_path] : []);
    const payload = { ...input, allocations, receipt_ids };
    let result;
    if (input.replaces_id) {
      exigir(
        uuid(input.replaces_id) && (input.correction_reason?.trim().length ?? 0) >= 3,
        "Indica o pagamento e o motivo da correção.",
      );
      result = await supabase.rpc("gestao_replace_payment", {
        p_id: input.replaces_id,
        p_input: payload,
        p_reason: input.correction_reason,
      });
    } else result = await supabase.rpc("gestao_register_payment", { p_input: payload });
    if (result.error)
      throw new Error(
        result.error.code === "23505"
          ? "Já existe um pagamento com esta referência. Confirma os movimentos antes de repetir."
          : result.error.message,
      );
    refresh();
    return { ok: true, id: result.data as string };
  } catch (e) {
    return fail(e);
  }
}
export async function voidPayment(id: string, reason: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(uuid(id) && reason.trim().length >= 3, "Indica o motivo da correção.");
    const { error } = await supabase.rpc("gestao_void_payment", { p_id: id, p_reason: reason });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
export async function confirmPeriod(input: {
  contract_id: string;
  ref_month: string;
  expected_amount: number;
  note: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(uuid(input.contract_id) && validMonth(input.ref_month), "Contrato ou mês inválidos.");
    exigir(eNumero(input.expected_amount) && input.expected_amount >= 0, "O valor devido deve ser válido.");
    exigir(input.note.trim().length >= 3, "Indica como verificaste o saldo deste mês.");
    const { error } = await supabase.rpc("gestao_confirm_period", {
      p_contract: input.contract_id,
      p_month: input.ref_month,
      p_expected: input.expected_amount,
      p_note: input.note,
    });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
export async function saveManagementCase(
  input: Partial<ManagementCase> & { request_id: string; title: string; kind: ManagementCase["kind"] },
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdmin();
    exigir(uuid(input.request_id) && (!input.id || uuid(input.id)), "Identificação da ocorrência inválida.");
    exigir(["cobranca", "tarefa", "manutencao", "vaga"].includes(input.kind), "Tipo de ocorrência inválido.");
    exigir(
      input.title.trim().length > 0 && input.title.length <= 200,
      "Indica um título até 200 caracteres.",
    );
    exigir(
      !["manutencao", "vaga"].includes(input.kind) || input.property_id,
      "Escolhe o imóvel desta ocorrência.",
    );
    exigir(
      ["aberto", "em_curso", "adiado", "concluido"].includes(input.status ?? "aberto"),
      "Estado inválido.",
    );
    exigir(
      ["baixa", "normal", "alta", "urgente"].includes(input.priority ?? "normal"),
      "Prioridade inválida.",
    );
    for (const field of ["due_date", "available_from", "vacancy_start", "vacancy_end"] as const)
      exigir(!input[field] || eData(input[field]), "Há uma data inválida.");
    for (const value of [input.budget, input.approved_budget, input.target_rent])
      exigir(
        value == null || (eNumero(value) && value >= 0 && value < 1e12),
        "Os montantes devem ser positivos ou zero.",
      );
    exigir(
      !input.vacancy_start || !input.vacancy_end || input.vacancy_end >= input.vacancy_start,
      "O fim da vaga é anterior ao início.",
    );
    if (input.listing_url) {
      const url = new URL(input.listing_url);
      exigir(["http:", "https:"].includes(url.protocol), "O anúncio deve ser uma ligação http ou https.");
    }
    if (input.property_id) exigir(uuid(input.property_id), "Imóvel inválido.");
    if (input.contract_id) exigir(uuid(input.contract_id), "Contrato inválido.");
    const paths = input.document_paths ?? [];
    if (paths.length) {
      exigir(input.property_id, "Escolhe o imóvel dos documentos.");
      await checkDocuments(supabase, input.property_id, paths);
    }
    const row = {
      kind: input.kind,
      property_id: input.property_id || null,
      contract_id: input.contract_id || null,
      title: input.title.trim(),
      description: input.description || null,
      status: input.status ?? "aberto",
      responsible: input.responsible || null,
      due_date: input.due_date || null,
      next_step: input.next_step || null,
      priority: input.priority ?? "normal",
      supplier: input.supplier || null,
      budget: input.budget ?? null,
      approved_budget: input.approved_budget ?? null,
      availability_state: input.availability_state || null,
      available_from: input.available_from || null,
      vacancy_start: input.vacancy_start || null,
      vacancy_end: input.vacancy_end || null,
      target_rent: input.target_rent ?? null,
      preparation: input.preparation || null,
      listing_url: input.listing_url || null,
      document_paths: paths,
    };
    let result;
    if (input.id)
      result = await supabase
        .from("management_cases")
        .update(row)
        .eq("id", input.id)
        .eq("updated_at", input.updated_at)
        .select("id")
        .single();
    else
      result = await supabase
        .from("management_cases")
        .upsert(
          { ...row, request_id: input.request_id, created_by: user.id },
          { onConflict: "request_id", ignoreDuplicates: true },
        )
        .select("id");
    if (result.error)
      throw new Error(
        result.error.code === "PGRST116"
          ? "A ocorrência foi alterada entretanto. Atualiza a página antes de voltar a guardar."
          : result.error.message,
      );
    const data = result.data;
    let id = Array.isArray(data) ? data[0]?.id : data?.id;
    if (!id && !input.id) {
      const existing = await supabase
        .from("management_cases")
        .select("id")
        .eq("request_id", input.request_id)
        .single();
      if (existing.error) throw new Error(existing.error.message);
      id = existing.data.id;
    }
    refresh();
    return { ok: true, id: id || input.id };
  } catch (e) {
    return fail(e);
  }
}
export async function saveManagementEvent(input: {
  case_id: string;
  kind: string;
  occurred_on: string;
  note: string;
  next_step?: string;
  due_date?: string;
  request_id: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(uuid(input.case_id) && uuid(input.request_id), "Ocorrência inválida.");
    exigir(["nota", "contacto", "acordo", "visita"].includes(input.kind), "Tipo de diligência inválido.");
    exigir(eData(input.occurred_on) && (!input.due_date || eData(input.due_date)), "Há uma data inválida.");
    exigir(input.note.trim().length > 0 && input.note.length <= 5000, "Indica o contacto, acordo ou nota.");
    const { data, error } = await supabase.rpc("gestao_save_event", { p_input: input });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, id: data as string };
  } catch (e) {
    return fail(e);
  }
}
export async function saveCaseExpense(input: {
  case_id: string;
  amount: number;
  expense_date: string;
  category: string;
  description: string;
  landlord_id?: string;
  request_id: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(uuid(input.case_id) && uuid(input.request_id), "Ocorrência inválida.");
    exigir(
      eNumero(input.amount) && input.amount > 0 && eData(input.expense_date),
      "Indica um custo positivo e a data real.",
    );
    exigir(
      ["imi", "condominio", "conservacao", "seguro", "obras", "financiamento", "outras"].includes(
        input.category,
      ),
      "Categoria inválida.",
    );
    const { data, error } = await supabase.rpc("gestao_case_expense", { p_input: input });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, id: data as string };
  } catch (e) {
    return fail(e);
  }
}
export interface ReceiptAssociation {
  receipt_id: string;
  contract_id: string;
  old_contract_id: string | null;
  old_property_id: string | null;
  number: string | null;
  month: string;
  amount: number;
  source: string;
  tenant: string;
  warnings: string[];
}
export async function previewReceiptLinks(
  choices: Array<{ receipt_id: string; contract_id: string }>,
): Promise<ActionResult & { plan?: ReceiptAssociation[] }> {
  try {
    const { supabase } = await requireAdmin();
    exigir(
      choices.length > 0 &&
        choices.length <= 500 &&
        choices.every((c) => uuid(c.receipt_id) && uuid(c.contract_id)),
      "Seleciona entre 1 e 500 recibos e os contratos de destino.",
    );
    exigir(
      new Set(choices.map((c) => c.receipt_id)).size === choices.length,
      "Há recibos repetidos na seleção.",
    );
    const [rq, cq] = await Promise.all([
      supabase
        .from("receipts")
        .select("*")
        .in(
          "id",
          choices.map((c) => c.receipt_id),
        ),
      supabase.from("contracts").select("*"),
    ]);
    const receipts = linhas<Receipt>(rq, "receipts");
    const contracts = linhas<Contract>(cq, "contracts");
    const plan = choices.map((choice) => {
      const receipt = receipts.find((r) => r.id === choice.receipt_id);
      const contract = contracts.find((c) => c.id === choice.contract_id);
      exigir(receipt && !receipt.cancelled && contract, "Recibo ou contrato inexistente, ou recibo anulado.");
      const candidates = receiptCandidates(receipt, contracts);
      return {
        ...choice,
        old_contract_id: receipt.contract_id,
        old_property_id: receipt.property_id,
        number: receipt.receipt_number,
        month: receipt.ref_month,
        amount: Number(receipt.amount),
        source: receipt.source,
        tenant: contract.tenant_name,
        warnings: [
          ...(candidates.length > 1 ? ["Vários contratos possíveis; confirmar a escolha."] : []),
          ...(!candidates.some((c) => c.contract.id === contract.id)
            ? ["A escolha não coincide com as correspondências documentais."]
            : []),
        ],
      };
    });
    return { ok: true, plan };
  } catch (e) {
    return fail(e);
  }
}
export async function applyReceiptLinks(plan: ReceiptAssociation[], note: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(
      plan.length > 0 && plan.length <= 500 && plan.every((p) => uuid(p.receipt_id) && uuid(p.contract_id)),
      "Plano inválido.",
    );
    exigir(
      new Set(plan.map((p) => p.receipt_id)).size === plan.length && note.trim().length >= 3,
      "Indica o motivo e evita recibos repetidos.",
    );
    const links = plan.map(({ receipt_id, contract_id, old_contract_id, old_property_id }) => ({
      receipt_id,
      contract_id,
      old_contract_id,
      old_property_id,
    }));
    const { data, error } = await supabase.rpc("gestao_link_receipts", { p_links: links, p_note: note });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, info: `${data} recibos associados.` };
  } catch (e) {
    return fail(e);
  }
}
export async function saveContractTerms(input: {
  id: string;
  term_kind: string;
  expected_end_date: string | null;
  duration_months: number | null;
  renewal_months: number | null;
  notice_days_landlord: number | null;
  notice_days_tenant: number | null;
  term_source: string;
  terms_confirmed_at: string | null;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(uuid(input.id), "Contrato inválido.");
    exigir(["desconhecido", "sem_termo", "prazo_certo"].includes(input.term_kind), "Tipo de prazo inválido.");
    exigir(!input.expected_end_date || eData(input.expected_end_date), "Data de fim prevista inválida.");
    exigir(!input.terms_confirmed_at || eData(input.terms_confirmed_at), "Data de confirmação inválida.");
    exigir(
      !input.terms_confirmed_at || input.terms_confirmed_at <= todayISO(),
      "A confirmação documental não pode ter uma data futura.",
    );
    const contract = await supabase.from("contracts").select("start_date").eq("id", input.id).single();
    exigir(!contract.error && contract.data, "Contrato inexistente.");
    exigir(
      !input.expected_end_date ||
        !contract.data.start_date ||
        input.expected_end_date >= contract.data.start_date,
      "O fim previsto é anterior ao início do contrato.",
    );
    exigir(
      !input.terms_confirmed_at || input.term_kind !== "prazo_certo" || input.expected_end_date,
      "Indica o fim previsto do prazo certo verificado.",
    );
    for (const n of [input.duration_months, input.renewal_months])
      exigir(
        n == null || (Number.isInteger(n) && n > 0 && n <= 1200),
        "Duração e renovação devem ser meses inteiros positivos.",
      );
    for (const n of [input.notice_days_landlord, input.notice_days_tenant])
      exigir(
        n == null || (Number.isInteger(n) && n >= 0 && n <= 3650),
        "Os pré-avisos devem ser dias inteiros.",
      );
    exigir(
      !input.terms_confirmed_at || input.term_source.trim(),
      "Identifica o documento que confirma os prazos.",
    );
    exigir(
      input.term_kind !== "sem_termo" || !input.expected_end_date,
      "Um contrato sem termo não tem fim previsto.",
    );
    const { id, ...row } = input;
    const { error } = await supabase.from("contracts").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
export async function saveQuotaEvidence(input: {
  property_id: string;
  remainder_kind: string;
  confirmed_landlords: string[];
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(
      uuid(input.property_id) &&
        ["por_confirmar", "externa"].includes(input.remainder_kind) &&
        input.confirmed_landlords.every(uuid),
      "Dados de titularidade inválidos.",
    );
    const { error } = await supabase.rpc("gestao_quota_evidence", {
      p_property: input.property_id,
      p_remainder: input.remainder_kind,
      p_confirmed: input.confirmed_landlords,
    });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
export async function associateExpense(expenseId: string, caseId: string | null): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(uuid(expenseId) && (!caseId || uuid(caseId)), "Despesa ou intervenção inválida.");
    const eq = await supabase.from("expenses").select("property_id").eq("id", expenseId).single();
    exigir(!eq.error && eq.data, "Despesa inexistente.");
    if (caseId) {
      const cq = await supabase.from("management_cases").select("property_id,kind").eq("id", caseId).single();
      exigir(
        !cq.error && cq.data?.kind === "manutencao" && cq.data.property_id === eq.data.property_id,
        "A intervenção deve pertencer ao mesmo imóvel.",
      );
    }
    const { error } = await supabase.from("expenses").update({ case_id: caseId }).eq("id", expenseId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
export async function linkPaymentReceipts(movementId: string, receiptIds: string[]): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(
      uuid(movementId) && receiptIds.length > 0 && receiptIds.length <= 500 && receiptIds.every(uuid),
      "Pagamento ou recibos inválidos.",
    );
    const { error } = await supabase.rpc("gestao_reconcile_payment", {
      p_movement: movementId,
      p_receipts: receiptIds,
    });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
