"use server";

import { revalidatePath } from "next/cache";
import type {
  ContractStatus,
  ExpenseCategory,
  PropertyStatus,
  Role,
} from "@/lib/types";
import { fail, requireAdmin, type ActionResult } from "./util";
import {
  eData,
  exigir,
  validarAtualizacaoRenda,
  validarContrato,
  validarDespesa,
  validarPositivoOpcional,
  validarTitulares,
} from "../validar";

function refresh() {
  revalidatePath("/", "layout");
}

// ---------- Senhorios ----------
export async function saveLandlord(input: {
  id?: string;
  name: string;
  nif?: string | null;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(input.name?.trim(), "Falta o nome do senhorio.");
    const row = { name: input.name.trim(), nif: input.nif?.trim() || null, notes: input.notes || null };
    if (input.id) {
      const { error } = await supabase.from("landlords").update(row).eq("id", input.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("landlords").insert(row);
      if (error) throw new Error(error.message);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Frações ----------
export interface PropertyInput {
  id?: string;
  name: string;
  address?: string | null;
  postal_code?: string | null;
  municipality?: string | null;
  parish?: string | null;
  dicofre?: string | null;
  typology?: string | null;
  area_m2?: number | null;
  vpt?: number | null;
  vpt_year?: number | null;
  matriz_article?: string | null;
  status: PropertyStatus;
  notes?: string | null;
  owners: Array<{ landlord_id: string; quota: number }>;
}

export async function saveProperty(input: PropertyInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(input.name?.trim(), "Falta o nome da fração.");
    validarPositivoOpcional(input.area_m2, "A área");
    validarPositivoOpcional(input.vpt, "O VPT");
    validarTitulares(input.owners);
    const row = {
      name: input.name.trim(),
      address: input.address || null,
      postal_code: input.postal_code || null,
      municipality: input.municipality || null,
      parish: input.parish || null,
      dicofre: input.dicofre?.trim() || null,
      typology: input.typology || null,
      area_m2: input.area_m2 ?? null,
      vpt: input.vpt ?? null,
      vpt_year: input.vpt_year ?? null,
      matriz_article: input.matriz_article || null,
      status: input.status,
      notes: input.notes || null,
    };

    let propertyId = input.id;
    if (propertyId) {
      const { error } = await supabase.from("properties").update(row).eq("id", propertyId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase
        .from("properties")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      propertyId = data.id as string;
    }

    // Substitui os proprietários: PRIMEIRO grava os novos, DEPOIS poda os que saíram.
    // Era ao contrário (apagar tudo e inserir), e um insert que falhasse deixava a fração
    // sem titulares nenhuns: as quotas alimentam o IRS e o AIMI de cada senhorio. Assim, o
    // pior que uma falha a meio deixa é um titular a mais, que a Saúde dos dados assinala.
    if (input.owners.length > 0) {
      const { error: ownErr } = await supabase.from("property_owners").upsert(
        input.owners.map((o) => ({
          property_id: propertyId,
          landlord_id: o.landlord_id,
          quota: o.quota,
        })),
        { onConflict: "property_id,landlord_id" },
      );
      if (ownErr) throw new Error(ownErr.message);
    }
    let poda = supabase.from("property_owners").delete().eq("property_id", propertyId);
    if (input.owners.length > 0) {
      // Os ids são uuids do próprio Supabase, por isso a lista do `in` não precisa de aspas.
      poda = poda.not("landlord_id", "in", `(${input.owners.map((o) => o.landlord_id).join(",")})`);
    }
    const { error: delErr } = await poda;
    if (delErr) throw new Error(delErr.message);

    refresh();
    return { ok: true, id: propertyId };
  } catch (e) {
    return fail(e);
  }
}

/** Preenchimento em LOTE da ficha (V3): área, tipologia e VPT de várias frações de uma vez.
 *
 *  Existe porque a alternativa era abrir ~61 formulários modais, um por fração, para copiar
 *  três campos da caderneta predial. É esse preenchimento que desbloqueia o €/m² vs INE, o
 *  valor estimado e o yield — hoje nulos em quase toda a carteira (PLANO.md Apêndice B.2).
 *
 *  Só escreve os campos que vieram preenchidos: um campo deixado em branco NÃO apaga o que
 *  já lá está, senão gravar a linha de uma fração meia preenchida destruía o resto.
 */
export async function preencherFichas(
  fichas: Array<{ id: string; area_m2?: number | null; typology?: string | null; vpt?: number | null }>,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    let n = 0;
    for (const f of fichas) {
      validarPositivoOpcional(f.area_m2, "A área");
      validarPositivoOpcional(f.vpt, "O VPT");
      const row: Record<string, number | string> = {};
      if (f.area_m2 != null && f.area_m2 > 0) row.area_m2 = f.area_m2;
      if (f.typology) row.typology = f.typology.trim();
      if (f.vpt != null && f.vpt > 0) row.vpt = f.vpt;
      if (Object.keys(row).length === 0) continue;
      const { error } = await supabase.from("properties").update(row).eq("id", f.id);
      if (error) throw new Error(error.message);
      n++;
    }
    refresh();
    return { ok: true, info: n === 1 ? "1 ficha atualizada." : `${n} fichas atualizadas.` };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Contratos ----------
export interface ContractInput {
  id?: string;
  property_id: string;
  tenant_name: string;
  tenant_nif?: string | null;
  pf_contract_no?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  rent: number;
  due_day: number;
  status: ContractStatus;
  notes?: string | null;
}

export async function saveContract(input: ContractInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    validarContrato(input);
    const row = {
      property_id: input.property_id,
      tenant_name: input.tenant_name.trim(),
      tenant_nif: input.tenant_nif || null,
      pf_contract_no: input.pf_contract_no || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      rent: input.rent,
      due_day: input.due_day,
      status: input.status,
      notes: input.notes || null,
    };
    if (input.id) {
      const { error } = await supabase.from("contracts").update(row).eq("id", input.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("contracts").insert(row);
      if (error) throw new Error(error.message);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Cessa um contrato numa data (por defeito hoje). */
export async function endContract(input: { id: string; end_date: string }): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(eData(input.end_date), "A data de fim não é uma data válida.");
    const { error } = await supabase
      .from("contracts")
      .update({ status: "cessado", end_date: input.end_date })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteContract(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Atualiza a renda de um contrato registando o histórico em rent_updates. */
export async function applyRentUpdate(input: {
  contract_id: string;
  new_rent: number;
  effective_date: string;
  reason: "coeficiente" | "acordo" | "novo_contrato" | "outro";
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    validarAtualizacaoRenda(input);
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("rent")
      .eq("id", input.contract_id)
      .single();
    if (cErr) throw new Error(cErr.message);

    // Duas escritas sem transação (o PostgREST não as dá sem uma função SQL, e uma
    // migração não se reverte com git). A compensação faz o papel dela: o histórico grava-se
    // primeiro e, se a renda do contrato não mudar, apaga-se outra vez. Sem isto o histórico
    // podia afirmar uma renda que o contrato não tinha.
    const { data: historico, error: uErr } = await supabase
      .from("rent_updates")
      .insert({
        contract_id: input.contract_id,
        effective_date: input.effective_date,
        old_rent: contract.rent,
        new_rent: input.new_rent,
        reason: input.reason,
      })
      .select("id")
      .single();
    if (uErr) throw new Error(uErr.message);

    const { error: upErr } = await supabase
      .from("contracts")
      .update({ rent: input.new_rent })
      .eq("id", input.contract_id);
    if (upErr) {
      await supabase.from("rent_updates").delete().eq("id", historico.id);
      throw new Error(upErr.message);
    }

    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveExpense(input: {
  id?: string;
  property_id?: string | null;
  landlord_id?: string | null;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  description?: string | null;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    validarDespesa(input);
    const row = {
      property_id: input.property_id || null,
      landlord_id: input.landlord_id || null,
      expense_date: input.expense_date,
      category: input.category,
      amount: input.amount,
      description: input.description || null,
    };
    if (input.id) {
      const { error } = await supabase.from("expenses").update(row).eq("id", input.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("expenses").insert(row);
      if (error) throw new Error(error.message);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Coeficientes de atualização de rendas ----------
export async function saveUpdateCoefficient(input: {
  year: number;
  coefficient: number;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    exigir(Number.isInteger(input.year) && input.year >= 2000, "O ano do coeficiente não é válido.");
    // O coeficiente anual anda à volta de 1 (1,0216 em 2025). Fora de [0,9; 1,2] é quase de
    // certeza uma vírgula no sítio errado, e multiplicava todas as rendas sugeridas.
    exigir(
      Number.isFinite(input.coefficient) && input.coefficient >= 0.9 && input.coefficient <= 1.2,
      "O coeficiente tem de estar entre 0,9 e 1,2 (por exemplo 1,0216).",
    );
    const { error } = await supabase
      .from("update_coefficients")
      .upsert({ year: input.year, coefficient: input.coefficient });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Utilizadores ----------
export async function setProfileRole(input: { id: string; role: Role }): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdmin();
    if (input.id === user.id && input.role !== "admin") {
      throw new Error("Não podes remover o teu próprio acesso de administrador.");
    }
    const { error } = await supabase
      .from("profiles")
      .update({ role: input.role })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
