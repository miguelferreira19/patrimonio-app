"use server";

import { revalidatePath } from "next/cache";
import type {
  ContractStatus,
  ExpenseCategory,
  PaymentMethod,
  PropertyStatus,
  Role,
} from "@/lib/types";
import { fail, requireAdmin, type ActionResult } from "./util";

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
    const row = { name: input.name.trim(), nif: input.nif || null, notes: input.notes || null };
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

    // substitui os proprietários
    const { error: delErr } = await supabase
      .from("property_owners")
      .delete()
      .eq("property_id", propertyId);
    if (delErr) throw new Error(delErr.message);
    if (input.owners.length > 0) {
      const { error: ownErr } = await supabase.from("property_owners").insert(
        input.owners.map((o) => ({
          property_id: propertyId,
          landlord_id: o.landlord_id,
          quota: o.quota,
        })),
      );
      if (ownErr) throw new Error(ownErr.message);
    }

    refresh();
    return { ok: true, id: propertyId };
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
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("rent")
      .eq("id", input.contract_id)
      .single();
    if (cErr) throw new Error(cErr.message);

    const { error: uErr } = await supabase.from("rent_updates").insert({
      contract_id: input.contract_id,
      effective_date: input.effective_date,
      old_rent: contract.rent,
      new_rent: input.new_rent,
      reason: input.reason,
    });
    if (uErr) throw new Error(uErr.message);

    const { error: upErr } = await supabase
      .from("contracts")
      .update({ rent: input.new_rent })
      .eq("id", input.contract_id);
    if (upErr) throw new Error(upErr.message);

    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Pagamentos ----------
export async function markPayment(input: {
  contract_id: string;
  ref_month: string; // YYYY-MM-01
  amount: number;
  received_date: string;
  method: PaymentMethod;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("payments").upsert(
      {
        contract_id: input.contract_id,
        ref_month: input.ref_month,
        amount: input.amount,
        received_date: input.received_date,
        method: input.method,
        source: "manual",
        notes: input.notes || null,
      },
      { onConflict: "contract_id,ref_month" },
    );
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removePayment(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Despesas ----------
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
