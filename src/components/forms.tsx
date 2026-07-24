"use client";

// Formulários de escrita (admin): frações, contratos, rendas, despesas, senhorios.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  applyRentUpdate,
  deleteContract,
  deleteExpense,
  deleteProperty,
  endContract,
  saveContract,
  saveExpense,
  saveLandlord,
  saveProperty,
} from "@/lib/actions/crud";
import type { ActionResult } from "@/lib/actions/util";
import { todayISO } from "@/lib/format";
import type {
  Contract,
  Expense,
  ExpenseCategory,
  Landlord,
  Property,
  PropertyOwner,
} from "@/lib/types";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/types";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";

function numOrNull(s: string): number | null {
  if (s.trim() === "") return null;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

/** Opção de território (código INE) para ligar frações aos benchmarks. */
export interface GeoOption {
  code: string;
  label: string;
  level: "freguesia" | "concelho";
}

export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(p: Promise<ActionResult>, onOk?: () => void) {
    setPending(true);
    setError(null);
    const res = await p;
    setPending(false);
    if (res.ok) {
      onOk?.();
      router.refresh();
    } else {
      setError(res.error);
    }
  }
  return { pending, error, run, setError };
}

// ============================================================
// Fração
// ============================================================
export function PropertyFormButton({
  landlords,
  geoOptions = [],
  property,
  owners,
  label,
  small,
}: {
  landlords: Landlord[];
  geoOptions?: GeoOption[];
  property?: Property;
  owners?: PropertyOwner[];
  label?: string;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useAction();

  const [f, setF] = useState(() => ({
    name: property?.name ?? "",
    address: property?.address ?? "",
    postal_code: property?.postal_code ?? "",
    municipality: property?.municipality ?? "",
    parish: property?.parish ?? "",
    dicofre: property?.dicofre ?? "",
    typology: property?.typology ?? "",
    area_m2: property?.area_m2?.toString() ?? "",
    vpt: property?.vpt?.toString() ?? "",
    vpt_year: property?.vpt_year?.toString() ?? "",
    matriz_article: property?.matriz_article ?? "",
    status: property?.status ?? ("arrendado" as const),
    notes: property?.notes ?? "",
  }));
  const [own, setOwn] = useState<Array<{ landlord_id: string; quota: string }>>(
    owners && owners.length > 0
      ? owners.map((o) => ({ landlord_id: o.landlord_id, quota: String(o.quota) }))
      : [{ landlord_id: landlords[0]?.id ?? "", quota: "100" }],
  );

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      saveProperty({
        id: property?.id,
        name: f.name,
        address: f.address || null,
        postal_code: f.postal_code || null,
        municipality: f.municipality || null,
        parish: f.parish || null,
        dicofre: f.dicofre || null,
        typology: f.typology || null,
        area_m2: numOrNull(f.area_m2),
        vpt: numOrNull(f.vpt),
        vpt_year: numOrNull(f.vpt_year),
        matriz_article: f.matriz_article || null,
        status: f.status,
        notes: f.notes || null,
        owners: own
          .filter((o) => o.landlord_id)
          .map((o) => ({ landlord_id: o.landlord_id, quota: numOrNull(o.quota) ?? 100 })),
      }),
      () => setOpen(false),
    );
  }

  return (
    <>
      <Button
        variant={property ? "outline" : "primary"}
        size={small ? "sm" : "md"}
        onClick={() => setOpen(true)}
      >
        {property ? <Pencil size={14} /> : <Plus size={16} />}
        {label ?? (property ? "Editar" : "Nova fração")}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={property ? "Editar fração" : "Nova fração"} wide>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nome curto *">
              <Input value={f.name} onChange={(e) => set("name", e.target.value)} required placeholder="R. das Flores 12, 2º Esq" />
            </Field>
            <Field label="Morada completa">
              <Input value={f.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="Código postal">
              <Input value={f.postal_code} onChange={(e) => set("postal_code", e.target.value)} placeholder="1000-100" />
            </Field>
            <Field label="Concelho">
              <Input value={f.municipality} onChange={(e) => set("municipality", e.target.value)} />
            </Field>
            <Field label="Freguesia">
              <Input value={f.parish} onChange={(e) => set("parish", e.target.value)} />
            </Field>
            <Field label="Território INE (para benchmarks de mercado)">
              {geoOptions.length > 0 ? (
                <Select value={f.dicofre} onChange={(e) => set("dicofre", e.target.value)}>
                  <option value="">Sem ligação ao INE</option>
                  {f.dicofre && !geoOptions.some((g) => g.code === f.dicofre) && (
                    <option value={f.dicofre}>Código atual: {f.dicofre}</option>
                  )}
                  <optgroup label="Freguesias">
                    {geoOptions
                      .filter((g) => g.level === "freguesia")
                      .map((g) => (
                        <option key={g.code} value={g.code}>
                          {g.label}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Concelhos (mediana mais lata)">
                    {geoOptions
                      .filter((g) => g.level === "concelho")
                      .map((g) => (
                        <option key={g.code} value={g.code}>
                          {g.label}
                        </option>
                      ))}
                  </optgroup>
                </Select>
              ) : (
                <Input
                  value={f.dicofre}
                  onChange={(e) => set("dicofre", e.target.value)}
                  placeholder="Atualiza os benchmarks INE no Admin para escolher aqui"
                />
              )}
            </Field>
            <Field label="Tipologia">
              <Input value={f.typology} onChange={(e) => set("typology", e.target.value)} placeholder="T2" />
            </Field>
            <Field label="Área bruta privativa (m²)">
              <Input value={f.area_m2} onChange={(e) => set("area_m2", e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="VPT (€)">
              <Input value={f.vpt} onChange={(e) => set("vpt", e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Ano do VPT">
              <Input value={f.vpt_year} onChange={(e) => set("vpt_year", e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Artigo matricial">
              <Input value={f.matriz_article} onChange={(e) => set("matriz_article", e.target.value)} />
            </Field>
            <Field label="Estado">
              <Select value={f.status} onChange={(e) => set("status", e.target.value)}>
                <option value="arrendado">Arrendado</option>
                <option value="vago">Vago</option>
                <option value="outro">Outro</option>
                <option value="terreno">Terreno</option>
                <option value="vendido">Vendido</option>
              </Select>
            </Field>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-zinc-600">Proprietários e quotas (%)</p>
            <div className="space-y-2">
              {own.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={o.landlord_id}
                    onChange={(e) =>
                      setOwn((p) => p.map((x, j) => (j === i ? { ...x, landlord_id: e.target.value } : x)))
                    }
                    className="flex-1"
                  >
                    {landlords.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={o.quota}
                    onChange={(e) =>
                      setOwn((p) => p.map((x, j) => (j === i ? { ...x, quota: e.target.value } : x)))
                    }
                    className="w-20"
                    inputMode="decimal"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOwn((p) => p.filter((_, j) => j !== i))}
                    disabled={own.length <= 1}
                    aria-label="Remover proprietário"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setOwn((p) => [...p, { landlord_id: landlords[0]?.id ?? "", quota: "50" }])}
            >
              <Plus size={14} /> Adicionar proprietário
            </Button>
          </div>

          <Field label="Notas">
            <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </Field>

          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "A gravar…" : "Gravar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function DeletePropertyButton({ id }: { id: string }) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  return (
    <div className="inline-flex flex-col items-end">
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            confirm(
              "Apagar esta fração? Apaga também contratos, pagamentos, recibos e despesas associados.",
            )
          ) {
            run(deleteProperty(id), () => router.push("/fracoes"));
          }
        }}
      >
        <Trash2 size={14} /> Apagar fração
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ============================================================
// Contrato
// ============================================================
export function ContractFormButton({
  propertyId,
  contract,
  label,
}: {
  propertyId: string;
  contract?: Contract;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useAction();
  const [f, setF] = useState(() => ({
    tenant_name: contract?.tenant_name ?? "",
    tenant_nif: contract?.tenant_nif ?? "",
    pf_contract_no: contract?.pf_contract_no ?? "",
    start_date: contract?.start_date ?? "",
    end_date: contract?.end_date ?? "",
    rent: contract?.rent?.toString() ?? "",
    due_day: contract?.due_day?.toString() ?? "1",
    status: contract?.status ?? ("ativo" as const),
    notes: contract?.notes ?? "",
  }));
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const rent = numOrNull(f.rent);
    if (rent === null) return;
    run(
      saveContract({
        id: contract?.id,
        property_id: propertyId,
        tenant_name: f.tenant_name,
        tenant_nif: f.tenant_nif || null,
        pf_contract_no: f.pf_contract_no || null,
        start_date: f.start_date || null,
        end_date: f.end_date || null,
        rent,
        due_day: numOrNull(f.due_day) ?? 1,
        status: f.status,
        notes: f.notes || null,
      }),
      () => setOpen(false),
    );
  }

  return (
    <>
      <Button variant={contract ? "outline" : "primary"} size="sm" onClick={() => setOpen(true)}>
        {contract ? <Pencil size={14} /> : <Plus size={14} />}
        {label ?? (contract ? "Editar contrato" : "Novo contrato")}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={contract ? "Editar contrato" : "Novo contrato"}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Inquilino *">
            <Input value={f.tenant_name} onChange={(e) => set("tenant_name", e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="NIF do inquilino">
              <Input value={f.tenant_nif} onChange={(e) => set("tenant_nif", e.target.value)} />
            </Field>
            <Field label="Nº contrato (Portal Finanças)">
              <Input value={f.pf_contract_no} onChange={(e) => set("pf_contract_no", e.target.value)} />
            </Field>
            <Field label="Início">
              <Input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </Field>
            <Field label="Fim (se cessado)">
              <Input type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </Field>
            <Field label="Renda mensal (€) *">
              <Input value={f.rent} onChange={(e) => set("rent", e.target.value)} inputMode="decimal" required />
            </Field>
            <Field label="Dia de vencimento">
              <Input value={f.due_day} onChange={(e) => set("due_day", e.target.value)} inputMode="numeric" />
            </Field>
          </div>
          <Field label="Estado">
            <Select value={f.status} onChange={(e) => set("status", e.target.value)}>
              <option value="ativo">Ativo</option>
              <option value="cessado">Cessado</option>
            </Select>
          </Field>
          <Field label="Notas">
            <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "A gravar…" : "Gravar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function RentUpdateButton({
  contract,
  suggestedRent,
}: {
  contract: { id: string; rent: number };
  /** Renda sugerida pelo coeficiente anual (P1-1), quando o contrato já está elegível. */
  suggestedRent?: number;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useAction();
  const [newRent, setNewRent] = useState(suggestedRent ? String(suggestedRent) : "");
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState<"coeficiente" | "acordo" | "novo_contrato" | "outro">("coeficiente");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = numOrNull(newRent);
    if (v === null) return;
    run(
      applyRentUpdate({ contract_id: contract.id, new_rent: v, effective_date: date, reason }),
      () => setOpen(false),
    );
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Atualizar renda
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Atualizar renda">
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-zinc-600">
            Renda atual: <strong className="tabular-nums">{contract.rent.toLocaleString("pt-PT")} €</strong>
            {suggestedRent && (
              <>
                {" "}
                · sugestão pelo coeficiente anual:{" "}
                <strong className="tabular-nums">{suggestedRent.toLocaleString("pt-PT")} €</strong>
              </>
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nova renda (€) *">
              <Input value={newRent} onChange={(e) => setNewRent(e.target.value)} inputMode="decimal" required autoFocus />
            </Field>
            <Field label="Produz efeitos a">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Motivo">
            <Select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
              <option value="coeficiente">Coeficiente anual</option>
              <option value="acordo">Acordo com inquilino</option>
              <option value="novo_contrato">Novo contrato</option>
              <option value="outro">Outro</option>
            </Select>
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "A gravar…" : "Gravar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function EndContractButton({ contractId }: { contractId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="inline-flex flex-col">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm("Cessar este contrato com data de hoje?")) {
            run(endContract({ id: contractId, end_date: todayISO() }));
          }
        }}
      >
        Cessar contrato
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function DeleteContractButton({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="inline-flex flex-col">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label="Apagar contrato"
        onClick={() => {
          if (confirm("Apagar contrato e pagamentos associados?")) run(deleteContract(id));
        }}
      >
        <Trash2 size={14} />
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ============================================================
// Despesa
// ============================================================
export function ExpenseFormButton({
  properties,
  expense,
  defaultPropertyId,
  label,
}: {
  properties: Array<{ id: string; name: string }>;
  expense?: Expense;
  defaultPropertyId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useAction();
  const [f, setF] = useState(() => ({
    property_id: expense?.property_id ?? defaultPropertyId ?? "",
    category: expense?.category ?? ("condominio" as ExpenseCategory),
    amount: expense?.amount?.toString() ?? "",
    expense_date: expense?.expense_date ?? todayISO(),
    description: expense?.description ?? "",
  }));
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = numOrNull(f.amount);
    if (amount === null) return;
    run(
      saveExpense({
        id: expense?.id,
        property_id: f.property_id || null,
        expense_date: f.expense_date,
        category: f.category as ExpenseCategory,
        amount,
        description: f.description || null,
      }),
      () => setOpen(false),
    );
  }

  return (
    <>
      <Button
        variant={expense ? "ghost" : "primary"}
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={expense ? (label ?? "Editar despesa") : undefined}
      >
        {expense ? <Pencil size={14} /> : <Plus size={14} />}
        {label ?? (expense ? "" : "Nova despesa")}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={expense ? "Editar despesa" : "Nova despesa"}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Fração">
            <Select value={f.property_id} onChange={(e) => set("property_id", e.target.value)}>
              <option value="">Geral (sem fração)</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select value={f.category} onChange={(e) => set("category", e.target.value)}>
                {Object.entries(EXPENSE_CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valor (€) *">
              <Input value={f.amount} onChange={(e) => set("amount", e.target.value)} inputMode="decimal" required />
            </Field>
          </div>
          <Field label="Data">
            <Input type="date" value={f.expense_date} onChange={(e) => set("expense_date", e.target.value)} />
          </Field>
          <Field label="Descrição">
            <Input value={f.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "A gravar…" : "Gravar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function DeleteExpenseButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label="Apagar despesa"
      onClick={() => {
        if (confirm("Apagar esta despesa?")) run(deleteExpense(id));
      }}
    >
      <Trash2 size={14} />
    </Button>
  );
}

// ============================================================
// Senhorio
// ============================================================
export function LandlordFormButton({ landlord }: { landlord?: Landlord }) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useAction();
  const [f, setF] = useState(() => ({
    name: landlord?.name ?? "",
    nif: landlord?.nif ?? "",
    notes: landlord?.notes ?? "",
  }));
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      saveLandlord({ id: landlord?.id, name: f.name, nif: f.nif || null, notes: f.notes || null }),
      () => setOpen(false),
    );
  }

  return (
    <>
      <Button
        variant={landlord ? "ghost" : "primary"}
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={landlord ? "Editar senhorio" : undefined}
      >
        {landlord ? <Pencil size={14} /> : <Plus size={14} />}
        {landlord ? "" : "Novo senhorio"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={landlord ? "Editar senhorio" : "Novo senhorio"}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nome *">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="NIF">
            <Input value={f.nif} onChange={(e) => set("nif", e.target.value)} />
          </Field>
          <Field label="Notas">
            <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "A gravar…" : "Gravar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
