"use server";

import { revalidatePath } from "next/cache";
import { fail, requireAdmin, type ActionResult } from "./util";

/** Linha de recibo já normalizada pelo wizard (datas em ISO, valores numéricos). */
export interface ReceiptRow {
  receipt_number?: string | null;
  pf_contract_no?: string | null;
  property_label: string; // morada / identificação do imóvel no ficheiro
  property_ref?: string | null; // identificador matricial (coluna "Imóvel")
  tenant_name?: string | null;
  ref_month: string; // YYYY-MM-01
  period_start?: string | null;
  period_end?: string | null;
  amount: number;
  issue_date?: string | null;
  raw?: Record<string, unknown>;
}

export interface ImportResult {
  createdProperties: number;
  createdContracts: number;
  insertedReceipts: number;
  insertedPayments: number;
  skippedRows: number;
}

function norm(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Importa um lote de recibos de um senhorio.
 * Cria automaticamente frações e contratos que ainda não existam
 * (por morada e por nº de contrato do Portal). Dedupe por nº de recibo.
 */
export async function importReceiptsChunk(input: {
  landlord_id: string;
  rows: ReceiptRow[];
  createPayments?: boolean;
}): Promise<ActionResult & { result?: ImportResult }> {
  try {
    const { supabase } = await requireAdmin();
    const { landlord_id } = input;

    const rows = input.rows.filter(
      (r) =>
        r.property_label?.trim() &&
        /^\d{4}-\d{2}-01$/.test(r.ref_month) &&
        Number.isFinite(r.amount),
    );
    const skippedRows = input.rows.length - rows.length;
    if (rows.length === 0) {
      return { ok: false, error: "Nenhuma linha válida (verifica o mapeamento de colunas)." };
    }

    // --- estado atual ---
    const [{ data: props, error: pErr }, { data: contracts, error: cErr }] = await Promise.all([
      supabase.from("properties").select("id,name,address,matriz_article"),
      supabase.from("contracts").select("id,property_id,pf_contract_no,tenant_name"),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (cErr) throw new Error(cErr.message);

    const propByLabel = new Map<string, string>();
    const propByMatriz = new Map<string, string>();
    for (const p of props ?? []) {
      propByLabel.set(norm(p.name), p.id);
      if (p.address) propByLabel.set(norm(p.address), p.id);
      if (p.matriz_article) propByMatriz.set(norm(p.matriz_article), p.id);
    }

    /** Resolve a fração de uma linha: primeiro pelo identificador matricial, depois pelo label. */
    function resolvePropertyId(r: { property_label: string; property_ref?: string | null }): string | undefined {
      const ref = r.property_ref?.trim();
      if (ref) {
        const id = propByMatriz.get(norm(ref));
        if (id) return id;
      }
      return propByLabel.get(norm(r.property_label));
    }

    // --- criar frações em falta (dedupe por identificador matricial quando existe, senão por label) ---
    const missingProps = new Map<string, { label: string; ref: string | null }>();
    for (const r of rows) {
      if (resolvePropertyId(r)) continue;
      const ref = r.property_ref?.trim() || null;
      const key = ref ? `ref::${norm(ref)}` : `label::${norm(r.property_label)}`;
      if (!missingProps.has(key)) {
        missingProps.set(key, { label: r.property_label.replace(/\s+/g, " ").trim(), ref });
      }
    }
    let createdProperties = 0;
    if (missingProps.size > 0) {
      const { data: created, error } = await supabase
        .from("properties")
        .insert(
          Array.from(missingProps.values()).map((m) => ({
            name: m.label,
            address: m.label,
            matriz_article: m.ref,
            status: "arrendado" as const,
            notes: "Criada automaticamente pelo import do Portal das Finanças.",
          })),
        )
        .select("id,name,matriz_article");
      if (error) throw new Error(error.message);
      for (const p of created ?? []) {
        propByLabel.set(norm(p.name), p.id);
        if (p.matriz_article) propByMatriz.set(norm(p.matriz_article), p.id);
      }
      createdProperties = created?.length ?? 0;

      // associa o senhorio do import como proprietário (quota 100 por defeito, editável depois)
      if (created && created.length > 0) {
        const { error: ownErr } = await supabase.from("property_owners").insert(
          created.map((p) => ({ property_id: p.id, landlord_id, quota: 100 })),
        );
        if (ownErr) throw new Error(ownErr.message);
      }
    }

    // --- contratos: por nº do Portal, senão por fração+inquilino ---
    const contractByPfNo = new Map<string, string>();
    const contractByPropTenant = new Map<string, string>();
    for (const c of contracts ?? []) {
      if (c.pf_contract_no) contractByPfNo.set(norm(c.pf_contract_no), c.id);
      contractByPropTenant.set(`${c.property_id}::${norm(c.tenant_name ?? "")}`, c.id);
    }

    interface NewContract {
      key: string;
      property_id: string;
      tenant_name: string;
      pf_contract_no: string | null;
      rent: number;
      latestMonth: string;
      start_date: string;
    }
    const newContracts = new Map<string, NewContract>();

    function contractKeyFor(r: ReceiptRow, propertyId: string): { key: string; existing?: string } {
      if (r.pf_contract_no) {
        const k = `pf::${norm(r.pf_contract_no)}`;
        const existing = contractByPfNo.get(norm(r.pf_contract_no));
        return { key: k, existing };
      }
      const tenant = norm(r.tenant_name ?? "");
      const k = `pt::${propertyId}::${tenant}`;
      const existing = contractByPropTenant.get(`${propertyId}::${tenant}`);
      return { key: k, existing };
    }

    for (const r of rows) {
      const propertyId = resolvePropertyId(r)!;
      const { key, existing } = contractKeyFor(r, propertyId);
      if (existing) continue;
      const start = r.period_start ?? r.ref_month;
      const cur = newContracts.get(key);
      if (!cur) {
        newContracts.set(key, {
          key,
          property_id: propertyId,
          tenant_name: r.tenant_name?.trim() || "Inquilino (importado)",
          pf_contract_no: r.pf_contract_no?.trim() || null,
          rent: r.amount,
          latestMonth: r.ref_month,
          start_date: start,
        });
      } else {
        if (r.ref_month > cur.latestMonth) {
          cur.latestMonth = r.ref_month;
          cur.rent = r.amount;
        }
        if (start < cur.start_date) cur.start_date = start;
      }
    }

    let createdContracts = 0;
    const contractIdByKey = new Map<string, string>();
    if (newContracts.size > 0) {
      const list = Array.from(newContracts.values());
      const { data: created, error } = await supabase
        .from("contracts")
        .insert(
          list.map((c) => ({
            property_id: c.property_id,
            tenant_name: c.tenant_name,
            pf_contract_no: c.pf_contract_no,
            rent: c.rent,
            start_date: c.start_date,
            due_day: 1,
            status: "ativo" as const,
            notes: "Criado automaticamente pelo import do Portal das Finanças.",
          })),
        )
        .select("id,property_id,pf_contract_no,tenant_name");
      if (error) throw new Error(error.message);
      createdContracts = created?.length ?? 0;
      for (const c of created ?? []) {
        if (c.pf_contract_no) contractByPfNo.set(norm(c.pf_contract_no), c.id);
        contractByPropTenant.set(`${c.property_id}::${norm(c.tenant_name ?? "")}`, c.id);
      }
      for (const c of list) {
        const id = c.pf_contract_no
          ? contractByPfNo.get(norm(c.pf_contract_no))
          : contractByPropTenant.get(`${c.property_id}::${norm(c.tenant_name)}`);
        if (id) contractIdByKey.set(c.key, id);
      }
    }

    // --- inserir recibos (dedupe por nº de recibo) ---
    const receiptRows = rows.map((r) => {
      const propertyId = resolvePropertyId(r)!;
      const { key, existing } = contractKeyFor(r, propertyId);
      const contractId = existing ?? contractIdByKey.get(key) ?? null;
      return {
        landlord_id,
        property_id: propertyId,
        contract_id: contractId,
        pf_contract_no: r.pf_contract_no?.trim() || null,
        receipt_number: r.receipt_number?.trim() || null,
        ref_month: r.ref_month,
        period_start: r.period_start ?? null,
        period_end: r.period_end ?? null,
        amount: r.amount,
        issue_date: r.issue_date ?? null,
        source: "portal",
        raw: r.raw ?? null,
      };
    });

    const { data: inserted, error: rErr } = await supabase
      .from("receipts")
      .upsert(receiptRows, {
        onConflict: "receipt_number",
        ignoreDuplicates: true,
      })
      .select("id");
    if (rErr) throw new Error(rErr.message);

    // --- opcional: registar também como pagamentos (rendas recebidas) ---
    let insertedPayments = 0;
    if (input.createPayments) {
      const paymentRows = receiptRows
        .filter((r) => r.contract_id)
        .map((r) => ({
          contract_id: r.contract_id as string,
          ref_month: r.ref_month,
          amount: r.amount,
          received_date: r.issue_date ?? null,
          method: "outro" as const,
          source: "recibo" as const,
        }));
      if (paymentRows.length > 0) {
        const { data: insertedP, error: payErr } = await supabase
          .from("payments")
          .upsert(paymentRows, {
            onConflict: "contract_id,ref_month",
            ignoreDuplicates: true,
          })
          .select("id");
        if (payErr) throw new Error(payErr.message);
        insertedPayments = insertedP?.length ?? 0;
      }
    }

    revalidatePath("/", "layout");
    return {
      ok: true,
      result: {
        createdProperties,
        createdContracts,
        insertedReceipts: inserted?.length ?? 0,
        insertedPayments,
        skippedRows,
      },
    };
  } catch (e) {
    return fail(e);
  }
}

/** Depois de importar tudo: alinha a renda dos contratos com o recibo mais recente. */
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
export interface ContractImportRow {
  pf_contract_no: string;
  property_label: string;
  property_ref?: string | null;
  tenant_name?: string | null;
  rent: number;
  status: "ativo" | "cessado";
  raw?: Record<string, unknown>;
}

export interface ContractImportResult {
  createdProperties: number;
  createdContracts: number;
  updatedContracts: number;
}

/**
 * Importa um lote da lista de contratos do Portal das Finanças (ListaContratos).
 * Deve ser corrido ANTES dos recibos: cria frações em falta e cria/atualiza
 * contratos por nº do Portal (fonte da verdade para renda e estado).
 */
export async function importContractsChunk(input: {
  landlord_id: string;
  rows: ContractImportRow[];
}): Promise<ActionResult & { result?: ContractImportResult }> {
  try {
    const { supabase } = await requireAdmin();
    const { landlord_id } = input;

    const rows = input.rows.filter(
      (r) => r.pf_contract_no?.trim() && r.property_label?.trim() && Number.isFinite(r.rent),
    );
    if (rows.length === 0) {
      return { ok: false, error: "Nenhuma linha válida (verifica o mapeamento de colunas)." };
    }

    const [{ data: props, error: pErr }, { data: contracts, error: cErr }] = await Promise.all([
      supabase.from("properties").select("id,name,address,matriz_article"),
      supabase.from("contracts").select("id,property_id,pf_contract_no"),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (cErr) throw new Error(cErr.message);

    const propByLabel = new Map<string, string>();
    const propByMatriz = new Map<string, string>();
    for (const p of props ?? []) {
      propByLabel.set(norm(p.name), p.id);
      if (p.address) propByLabel.set(norm(p.address), p.id);
      if (p.matriz_article) propByMatriz.set(norm(p.matriz_article), p.id);
    }

    function resolvePropertyId(r: { property_label: string; property_ref?: string | null }): string | undefined {
      const ref = r.property_ref?.trim();
      if (ref) {
        const id = propByMatriz.get(norm(ref));
        if (id) return id;
      }
      return propByLabel.get(norm(r.property_label));
    }

    // --- criar frações em falta ---
    const missingProps = new Map<string, { label: string; ref: string | null }>();
    for (const r of rows) {
      if (resolvePropertyId(r)) continue;
      const ref = r.property_ref?.trim() || null;
      const key = ref ? `ref::${norm(ref)}` : `label::${norm(r.property_label)}`;
      if (!missingProps.has(key)) {
        missingProps.set(key, { label: r.property_label.replace(/\s+/g, " ").trim(), ref });
      }
    }
    let createdProperties = 0;
    if (missingProps.size > 0) {
      const { data: created, error } = await supabase
        .from("properties")
        .insert(
          Array.from(missingProps.values()).map((m) => ({
            name: m.label,
            address: m.label,
            matriz_article: m.ref,
            status: "arrendado" as const,
            notes: "Criada automaticamente pelo import do Portal das Finanças.",
          })),
        )
        .select("id,name,matriz_article");
      if (error) throw new Error(error.message);
      for (const p of created ?? []) {
        propByLabel.set(norm(p.name), p.id);
        if (p.matriz_article) propByMatriz.set(norm(p.matriz_article), p.id);
      }
      createdProperties = created?.length ?? 0;

      if (created && created.length > 0) {
        const { error: ownErr } = await supabase.from("property_owners").insert(
          created.map((p) => ({ property_id: p.id, landlord_id, quota: 100 })),
        );
        if (ownErr) throw new Error(ownErr.message);
      }
    }

    // --- contratos: dedupe por nº do Portal (última linha do lote vence) ---
    const contractByPfNo = new Map<string, { id: string; property_id: string }>();
    for (const c of contracts ?? []) {
      if (c.pf_contract_no) {
        contractByPfNo.set(norm(c.pf_contract_no), { id: c.id, property_id: c.property_id });
      }
    }

    const byContractNo = new Map<string, ContractImportRow & { property_id: string }>();
    for (const r of rows) {
      const propertyId = resolvePropertyId(r);
      if (!propertyId) continue;
      byContractNo.set(norm(r.pf_contract_no), { ...r, property_id: propertyId });
    }

    const toInsert: Array<{
      property_id: string;
      tenant_name: string;
      pf_contract_no: string;
      rent: number;
      status: "ativo" | "cessado";
    }> = [];
    const toUpdate: Array<{ id: string; rent: number; status: "ativo" | "cessado"; tenant_name: string }> = [];
    const touchedProperties = new Set<string>();

    for (const r of byContractNo.values()) {
      const existing = contractByPfNo.get(norm(r.pf_contract_no));
      if (existing) {
        toUpdate.push({
          id: existing.id,
          rent: r.rent,
          status: r.status,
          tenant_name: r.tenant_name?.trim() || "",
        });
        touchedProperties.add(existing.property_id);
      } else {
        toInsert.push({
          property_id: r.property_id,
          tenant_name: r.tenant_name?.trim() || "Inquilino (importado)",
          pf_contract_no: r.pf_contract_no.trim(),
          rent: r.rent,
          status: r.status,
        });
        touchedProperties.add(r.property_id);
      }
    }

    let createdContracts = 0;
    if (toInsert.length > 0) {
      const { error } = await supabase.from("contracts").insert(
        toInsert.map((c) => ({
          ...c,
          due_day: 1,
          start_date: null,
          notes: "Criado automaticamente pelo import do Portal das Finanças.",
        })),
      );
      if (error) throw new Error(error.message);
      createdContracts = toInsert.length;
    }

    let updatedContracts = 0;
    await Promise.all(
      toUpdate.map(async (u) => {
        const update: Record<string, unknown> = { rent: u.rent, status: u.status };
        if (u.tenant_name) update.tenant_name = u.tenant_name;
        const { error } = await supabase.from("contracts").update(update).eq("id", u.id);
        if (error) throw new Error(error.message);
        updatedContracts++;
      }),
    );

    // --- fecha o ciclo: status da fração conforme tem ou não contrato ativo ---
    if (touchedProperties.size > 0) {
      const ids = Array.from(touchedProperties);
      const { data: activeContracts, error: activeErr } = await supabase
        .from("contracts")
        .select("property_id")
        .in("property_id", ids)
        .eq("status", "ativo");
      if (activeErr) throw new Error(activeErr.message);
      const activeSet = new Set((activeContracts ?? []).map((c) => c.property_id));
      const arrendadoIds = ids.filter((id) => activeSet.has(id));
      const vagoIds = ids.filter((id) => !activeSet.has(id));
      if (arrendadoIds.length > 0) {
        const { error } = await supabase
          .from("properties")
          .update({ status: "arrendado" })
          .in("id", arrendadoIds);
        if (error) throw new Error(error.message);
      }
      if (vagoIds.length > 0) {
        const { error } = await supabase.from("properties").update({ status: "vago" }).in("id", vagoIds);
        if (error) throw new Error(error.message);
      }
    }

    revalidatePath("/", "layout");
    return { ok: true, result: { createdProperties, createdContracts, updatedContracts } };
  } catch (e) {
    return fail(e);
  }
}

/** Linha do CSV de património predial, já normalizada pelo wizard. */
export interface PatrimonioImportRow {
  identificador: string;
  parte?: string | null;
  ano?: number | null;
  valor?: number | null;
  raw?: Record<string, unknown>;
}

export interface PatrimonioImportResult {
  matched: number;
  unmatched: number;
  updatedQuotas: number;
}

/**
 * Importa um lote do CSV de património predial. NÃO cria frações — só enriquece
 * as que já existem (por identificador matricial) com o VPT e a quota do senhorio.
 */
export async function importPatrimonioChunk(input: {
  landlord_id: string;
  rows: PatrimonioImportRow[];
}): Promise<ActionResult & { result?: PatrimonioImportResult }> {
  try {
    const { supabase } = await requireAdmin();
    const { landlord_id } = input;

    const rows = input.rows.filter((r) => r.identificador?.trim());
    if (rows.length === 0) {
      return { ok: false, error: "Nenhuma linha válida (verifica o mapeamento de colunas)." };
    }

    const { data: props, error: pErr } = await supabase.from("properties").select("id,matriz_article");
    if (pErr) throw new Error(pErr.message);

    const propByMatriz = new Map<string, string>();
    for (const p of props ?? []) {
      if (p.matriz_article) propByMatriz.set(norm(p.matriz_article), p.id);
    }

    let matched = 0;
    let unmatched = 0;
    const vptUpdates: Array<{ id: string; vpt: number; vpt_year: number | null }> = [];
    const quotaUpserts: Array<{ property_id: string; landlord_id: string; quota: number }> = [];

    for (const r of rows) {
      const propertyId = propByMatriz.get(norm(r.identificador));
      if (!propertyId) {
        unmatched++;
        continue;
      }
      matched++;

      if (r.valor !== null && r.valor !== undefined && Number.isFinite(r.valor)) {
        vptUpdates.push({ id: propertyId, vpt: r.valor, vpt_year: r.ano ?? null });
      }

      const parteMatch = r.parte?.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
      if (parteMatch) {
        const num = Number(parteMatch[1]);
        const den = Number(parteMatch[2]);
        if (den > 0) {
          quotaUpserts.push({
            property_id: propertyId,
            landlord_id,
            quota: Math.round(((100 * num) / den) * 100) / 100,
          });
        }
      }
    }

    await Promise.all(
      vptUpdates.map(async (u) => {
        const update: Record<string, unknown> = { vpt: u.vpt };
        if (u.vpt_year !== null) update.vpt_year = u.vpt_year;
        const { error } = await supabase.from("properties").update(update).eq("id", u.id);
        if (error) throw new Error(error.message);
      }),
    );

    let updatedQuotas = 0;
    if (quotaUpserts.length > 0) {
      const { data, error } = await supabase
        .from("property_owners")
        .upsert(quotaUpserts, { onConflict: "property_id,landlord_id" })
        .select("property_id");
      if (error) throw new Error(error.message);
      updatedQuotas = data?.length ?? 0;
    }

    revalidatePath("/", "layout");
    return { ok: true, result: { matched, unmatched, updatedQuotas } };
  } catch (e) {
    return fail(e);
  }
}
