"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Carregar } from "@/components/documentos/carregar";
import { parseAmount } from "@/lib/parse";
import { todayISO } from "@/lib/format";
import {
  CASE_STATUS_LABEL,
  AVAILABILITY_LABEL,
  type CaseKind,
  type ManagementCase,
  type PaymentMovement,
} from "@/lib/gestao";
import type { Contract, Property, Receipt } from "@/lib/types";
import {
  savePayment,
  voidPayment,
  confirmPeriod,
  saveManagementCase,
  saveManagementEvent,
  saveCaseExpense,
  saveContractTerms,
  saveQuotaEvidence,
  associateExpense,
  linkPaymentReceipts,
} from "@/lib/actions/gestao";
import type { ActionResult } from "@/lib/actions/util";

const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim();
const optional = (f: FormData, key: string) => text(f, key) || null;
const amount = (f: FormData, key: string) => parseAmount(text(f, key));
const integer = (f: FormData, key: string) => (text(f, key) ? Number(text(f, key)) : null);
export type Option = { id: string; label: string; propertyId?: string };
export function ExpenseAssociation({
  expenseId,
  cases,
  selected,
}: {
  expenseId: string;
  cases: Option[];
  selected?: string | null;
}) {
  return (
    <Operation
      title="Associar a intervenção"
      submit={(f) => associateExpense(expenseId, optional(f, "case"))}
    >
      <Choices name="case" label="Intervenção do mesmo imóvel" options={cases} value={selected} />
      <p className="text-xs text-tinta-2">
        Liga a despesa existente sem criar outra. A opção vazia remove a associação.
      </p>
    </Operation>
  );
}
export function ReceiptReconciliation({ movementId, receipts }: { movementId: string; receipts: Receipt[] }) {
  return (
    <Operation
      title="Reconciliar recibos posteriores"
      submit={(f) => linkPaymentReceipts(movementId, f.getAll("receipt").map(String))}
    >
      {receipts.map((r) => (
        <label key={r.id} className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="receipt" value={r.id} />
          {r.receipt_number} · {r.ref_month.slice(0, 7)}
        </label>
      ))}
      <p className="text-sm text-tinta-2">
        Associa apenas evidência documental; o montante confirmado mantém-se.
      </p>
    </Operation>
  );
}
export function Choices({
  name,
  label,
  options,
  value,
  required = false,
}: {
  name: string;
  label: string;
  options: Option[];
  value?: string | null;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <Select name={name} defaultValue={value ?? ""} required={required}>
        <option value="">Escolher</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
function F({
  name,
  label,
  value,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <Input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        required={required}
        inputMode={label.includes("€") ? "decimal" : undefined}
      />
    </Field>
  );
}
function Note({ name, label, value }: { name: string; label: string; value?: string | null }) {
  return (
    <Field label={label}>
      <Textarea name={name} defaultValue={value ?? ""} rows={3} />
    </Field>
  );
}

export function Operation({
  title,
  children,
  submit,
  after,
  button = "Guardar",
}: {
  title: string;
  children: ReactNode;
  submit: (f: FormData, request: string) => Promise<ActionResult>;
  after?: (r: Extract<ActionResult, { ok: true }>) => void;
  button?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const request = useRef({ key: "", id: "" });
  const router = useRouter();
  return (
    <details className="rounded-2xl border border-regua bg-carta p-4">
      <summary className="min-h-8 cursor-pointer text-sm font-semibold text-acao">{title}</summary>
      <form
        className="mt-4 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending) return;
          const form = e.currentTarget;
          const data = new FormData(form);
          const key = JSON.stringify([...data.entries()]);
          if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() };
          setPending(true);
          setError("");
          setSaved("");
          try {
            const r = await submit(data, request.current.id);
            if (!r.ok) setError(r.error);
            else {
              setSaved(r.info || "Guardado. O histórico foi atualizado.");
              after?.(r);
              router.refresh();
            }
          } catch {
            setError(
              "A ligação foi interrompida. Verifica o histórico; repetir a mesma operação não cria um duplicado.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
          {children}
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-perda">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-tinta">
            {saved}
          </p>
        )}
        <Button disabled={pending} type="submit">
          {pending ? "A guardar…" : button}
        </Button>
      </form>
    </details>
  );
}

export function PaymentForm({
  contract,
  property,
  month,
  expected,
  receipts,
  movement,
  allocations,
}: {
  contract: Contract;
  property: Property;
  month: string;
  expected: number;
  receipts: Receipt[];
  movement?: PaymentMovement;
  allocations?: string;
}) {
  const [proof, setProof] = useState(movement?.proof_path ?? "");
  return (
    <Operation
      title={movement ? "Corrigir pagamento" : "Registar pagamento confirmado"}
      submit={(f, request_id) =>
        savePayment({
          contract_id: contract.id,
          request_id,
          amount: amount(f, "amount") ?? NaN,
          received_date: text(f, "date"),
          method: text(f, "method"),
          reference: text(f, "reference"),
          notes: text(f, "notes"),
          allocation_text: text(f, "allocations"),
          proof_path: proof,
          receipt_ids: f.getAll("receipt").map(String),
          replaces_id: movement?.id,
          correction_reason: text(f, "reason"),
        })
      }
    >
      <input type="hidden" name="proof" value={proof} />
      <p className="text-sm text-tinta-2">
        Regista o dinheiro efetivamente recebido. Reparte um adiantamento ou vários meses por parcelas; os
        recibos associados não voltam a somar estes valores.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <F name="amount" label="Montante recebido (€)" value={movement?.amount ?? expected} required />
        <F
          name="date"
          label="Data do pagamento"
          type="date"
          value={movement?.received_date ?? todayISO()}
          required
        />
        <Choices
          name="method"
          label="Método"
          value={movement?.method ?? "transferencia"}
          options={[
            { id: "transferencia", label: "Transferência" },
            { id: "dinheiro", label: "Dinheiro" },
            { id: "outro", label: "Outro" },
          ]}
          required
        />
        <F name="reference" label="Referência do movimento" value={movement?.reference} />
      </div>
      <Note
        name="allocations"
        label="Repartição por mês: AAAA-MM = montante"
        value={allocations ?? `${month.slice(0, 7)} = ${expected}`}
      />
      <Note name="notes" label="Notas" value={movement?.notes} />
      {receipts.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Associar recibos já emitidos</legend>
          {receipts.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="receipt" value={r.id} />
              {r.receipt_number} · {r.ref_month.slice(0, 7)}
            </label>
          ))}
        </fieldset>
      )}
      <div className="space-y-2">
        <p className="text-sm font-medium">Comprovativo no arquivo do imóvel</p>
        <Carregar
          fracoes={[]}
          destino={{ matriz: property.matriz_article || property.id, label: property.name }}
          onUploaded={(paths) => setProof(paths[0] ?? proof)}
        />
        {proof && (
          <p className="break-all text-xs text-tinta-2">
            Comprovativo associado: {proof}
            <button type="button" className="ml-2 underline" onClick={() => setProof("")}>
              Desassociar
            </button>
          </p>
        )}
      </div>
      {movement && <F name="reason" label="Motivo da correção" required />}
    </Operation>
  );
}
export function VoidPayment({ id }: { id: string }) {
  return (
    <Operation
      title="Anular este registo"
      button="Anular pagamento"
      submit={(f) => voidPayment(id, text(f, "reason"))}
    >
      <F name="reason" label="Motivo da anulação" required />
      <p className="text-sm text-tinta-2">
        O movimento original permanece no histórico. Um recibo existente passa a ser apenas evidência
        documental.
      </p>
    </Operation>
  );
}
export function ConfirmPeriod({
  contractId,
  month,
  expected,
}: {
  contractId: string;
  month: string;
  expected: number;
}) {
  return (
    <Operation
      title="Verificar o saldo deste mês"
      submit={(f) =>
        confirmPeriod({
          contract_id: contractId,
          ref_month: month,
          expected_amount: amount(f, "amount") ?? NaN,
          note: text(f, "note"),
        })
      }
    >
      <p className="text-sm text-tinta-2">
        Confirma a obrigação deste mês após verificar os movimentos. A ausência de recibo, por si só, não
        confirma uma dívida.
      </p>
      <F name="amount" label="Valor líquido devido verificado (€)" value={expected} required />
      <F name="note" label="Como foi verificado e por quem" required />
    </Operation>
  );
}

export function CaseForm({
  kind,
  properties,
  contracts,
  initial,
  fixedProperty,
  fixedContract,
}: {
  kind: CaseKind;
  properties: Option[];
  contracts: Option[];
  initial?: ManagementCase;
  fixedProperty?: string;
  fixedContract?: string;
}) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(initial?.property_id ?? fixedProperty ?? "");
  const [paths, setPaths] = useState(initial?.document_paths ?? []);
  const [contractId, setContractId] = useState(initial?.contract_id ?? fixedContract ?? "");
  return (
    <Operation
      title={
        initial
          ? "Editar estado e dados"
          : {
              cobranca: "Criar diligência de cobrança",
              tarefa: "Criar tarefa",
              manutencao: "Abrir intervenção",
              vaga: "Registar disponibilidade",
            }[kind]
      }
      after={(r) => r.id && router.push(`/gestao/${r.id}`)}
      submit={(f, request_id) =>
        saveManagementCase({
          id: initial?.id,
          updated_at: initial?.updated_at,
          kind,
          request_id: initial?.request_id ?? request_id,
          title: text(f, "title"),
          property_id: propertyId || null,
          contract_id: contractId || null,
          description: optional(f, "description"),
          status: text(f, "status") as ManagementCase["status"],
          priority: text(f, "priority") as ManagementCase["priority"],
          responsible: optional(f, "responsible"),
          due_date: optional(f, "due"),
          next_step: optional(f, "next"),
          supplier: optional(f, "supplier"),
          budget: amount(f, "budget"),
          approved_budget: amount(f, "approved"),
          availability_state: optional(f, "availability") as ManagementCase["availability_state"],
          available_from: optional(f, "available"),
          vacancy_start: optional(f, "start"),
          vacancy_end: optional(f, "end"),
          target_rent: amount(f, "target"),
          preparation: optional(f, "preparation"),
          listing_url: optional(f, "listing"),
          document_paths: paths,
        })
      }
    >
      <input type="hidden" name="property" value={propertyId} />
      <input type="hidden" name="paths" value={paths.join("\n")} />
      <F name="title" label="Título" value={initial?.title} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Imóvel">
          <Select
            value={propertyId}
            onChange={(e) => {
              setPropertyId(e.target.value);
              setPaths([]);
              setContractId("");
            }}
            required={kind === "vaga" || kind === "manutencao"}
          >
            <option value="">Sem imóvel associado</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contrato / inquilino">
          <Select name="contract" value={contractId} onChange={(e) => setContractId(e.target.value)}>
            <option value="">Sem contrato associado</option>
            {contracts
              .filter((c) => !propertyId || !c.propertyId || c.propertyId === propertyId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </Select>
        </Field>
        <Choices
          name="status"
          label="Estado"
          value={initial?.status ?? "aberto"}
          options={Object.entries(CASE_STATUS_LABEL).map(([id, label]) => ({ id, label }))}
          required
        />
        <Choices
          name="priority"
          label="Prioridade"
          value={initial?.priority ?? "normal"}
          options={["baixa", "normal", "alta", "urgente"].map((id) => ({
            id,
            label: id[0].toUpperCase() + id.slice(1),
          }))}
          required
        />
        <F name="responsible" label="Responsável" value={initial?.responsible} />
        <F name="due" label="Prazo / próxima data" type="date" value={initial?.due_date} />
      </div>
      <Note name="description" label="Descrição" value={initial?.description} />
      <Note name="next" label="Próximo passo" value={initial?.next_step} />
      {kind === "manutencao" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <F name="supplier" label="Fornecedor" value={initial?.supplier} />
          <F name="budget" label="Orçamento proposto (€)" value={initial?.budget} />
          <F name="approved" label="Orçamento aprovado (€)" value={initial?.approved_budget} />
        </div>
      )}
      {kind === "vaga" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Choices
              name="availability"
              label="Disponibilidade"
              value={initial?.availability_state ?? "disponivel"}
              options={Object.entries(AVAILABILITY_LABEL).map(([id, label]) => ({ id, label }))}
              required
            />
            <F name="available" label="Disponível a partir de" type="date" value={initial?.available_from} />
            <F
              name="start"
              label="Início conhecido do período sem ocupação"
              type="date"
              value={initial?.vacancy_start}
            />
            <F name="end" label="Fim do período sem ocupação" type="date" value={initial?.vacancy_end} />
            <F name="target" label="Renda objetivo mensal (€)" value={initial?.target_rent} />
            <F name="listing" label="Ligação do anúncio" type="url" value={initial?.listing_url} />
          </div>
          <Note name="preparation" label="Preparação necessária" value={initial?.preparation} />
          <p className="text-sm text-tinta-2">
            Uma renda objetivo mede oportunidade estimada. Não representa uma perda financeira confirmada.
          </p>
        </>
      )}
      {propertyId && (
        <Attachments key={propertyId} propertyId={propertyId} paths={paths} setPaths={setPaths} />
      )}
    </Operation>
  );
}
function Attachments({
  propertyId,
  paths,
  setPaths,
}: {
  propertyId: string;
  paths: string[];
  setPaths: (p: string[]) => void;
}) {
  // The scope is fetched by the small authenticated endpoint; uploads remain direct to Storage.
  const [scope, setScope] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch(`/api/gestao/arquivo?imovel=${encodeURIComponent(propertyId)}`);
            if (!r.ok) throw new Error();
            setScope((await r.json()).scope);
          } catch {
            setError("Não foi possível abrir o arquivo. Tenta novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "A abrir arquivo…" : "Associar fotografias ou documentos"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-atencao">
          {error}
        </p>
      )}
      {scope && (
        <Carregar
          fracoes={[]}
          destino={{ matriz: scope, label: "Imóvel selecionado" }}
          onUploaded={(p) => setPaths([...new Set([...paths, ...p])])}
        />
      )}
      {paths.map((p) => (
        <p key={p} className="break-all text-xs text-tinta-2">
          {p}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setPaths(paths.filter((x) => x !== p))}
          >
            Desassociar
          </button>
        </p>
      ))}
    </div>
  );
}
export function EventForm({ caseId }: { caseId: string }) {
  return (
    <Operation
      title="Registar contacto, acordo ou nota"
      submit={(f, request_id) =>
        saveManagementEvent({
          case_id: caseId,
          request_id,
          kind: text(f, "kind"),
          occurred_on: text(f, "date"),
          note: text(f, "note"),
          next_step: text(f, "next"),
          due_date: text(f, "due"),
        })
      }
    >
      <Choices
        name="kind"
        label="Tipo"
        value="nota"
        required
        options={["nota", "contacto", "acordo", "visita"].map((id) => ({
          id,
          label: id[0].toUpperCase() + id.slice(1),
        }))}
      />
      <F name="date" label="Data" type="date" value={todayISO()} required />
      <Note name="note" label="Registo da diligência" />
      <Note name="next" label="Próximo passo" />
      <F name="due" label="Próxima data" type="date" />
      <p className="text-sm text-tinta-2">Este registo fica no histórico da aplicação.</p>
    </Operation>
  );
}
export function CaseExpenseForm({ caseId }: { caseId: string }) {
  return (
    <Operation
      title="Registar custo realizado"
      submit={(f, request_id) =>
        saveCaseExpense({
          case_id: caseId,
          request_id,
          amount: amount(f, "amount") ?? NaN,
          expense_date: text(f, "date"),
          category: text(f, "category"),
          description: text(f, "description"),
        })
      }
    >
      <F name="amount" label="Despesa do imóvel por inteiro (€)" required />
      <F name="date" label="Data da despesa" type="date" value={todayISO()} required />
      <Choices
        name="category"
        label="Categoria"
        value="conservacao"
        options={[
          { id: "conservacao", label: "Conservação" },
          { id: "obras", label: "Obras" },
          { id: "outras", label: "Outras" },
        ]}
        required
      />
      <F name="description" label="Descrição / referência da fatura" required />
      <p className="text-sm text-tinta-2">
        Cria uma única despesa ligada a esta intervenção. Se a fatura já existe, associa-a na lista de
        despesas.
      </p>
    </Operation>
  );
}
export function TermsForm({ contract }: { contract: Contract }) {
  return (
    <Operation
      title="Confirmar prazos do contrato"
      submit={(f) =>
        saveContractTerms({
          id: contract.id,
          term_kind: text(f, "kind"),
          expected_end_date: optional(f, "expected"),
          duration_months: integer(f, "duration"),
          renewal_months: integer(f, "renewal"),
          notice_days_landlord: integer(f, "ownerNotice"),
          notice_days_tenant: integer(f, "tenantNotice"),
          term_source: text(f, "source"),
          terms_confirmed_at: optional(f, "confirmed"),
        })
      }
    >
      <Choices
        name="kind"
        label="Tipo de prazo"
        value={contract.term_kind ?? "desconhecido"}
        options={[
          { id: "desconhecido", label: "Por confirmar" },
          { id: "sem_termo", label: "Sem termo" },
          { id: "prazo_certo", label: "Prazo certo" },
        ]}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <F name="expected" label="Fim previsto" type="date" value={contract.expected_end_date} />
        <F name="duration" label="Duração inicial (meses)" type="number" value={contract.duration_months} />
        <F name="renewal" label="Renovação (meses)" type="number" value={contract.renewal_months} />
        <F
          name="ownerNotice"
          label="Pré-aviso do proprietário (dias)"
          type="number"
          value={contract.notice_days_landlord}
        />
        <F
          name="tenantNotice"
          label="Pré-aviso do inquilino (dias)"
          type="number"
          value={contract.notice_days_tenant}
        />
        <F
          name="confirmed"
          label="Data da verificação documental"
          type="date"
          value={contract.terms_confirmed_at}
        />
      </div>
      <F name="source" label="Documento e cláusula que confirmam os prazos" value={contract.term_source} />
      <p className="text-sm text-tinta-2">
        A agenda usa apenas datas previstas confirmadas documentalmente. O fim efetivo é registado ao cessar o
        contrato; pré-avisos desconhecidos ficam em branco.
      </p>
    </Operation>
  );
}
export function QuotaEvidence({
  property,
  owners,
}: {
  property: Property;
  owners: Array<{ id: string; label: string; confirmed: boolean }>;
}) {
  return (
    <Operation
      title="Confirmar titularidade e quota restante"
      submit={(f) =>
        saveQuotaEvidence({
          property_id: property.id,
          remainder_kind: text(f, "kind"),
          confirmed_landlords: f.getAll("confirmed").map(String),
        })
      }
    >
      <Choices
        name="kind"
        label="Quota não registada"
        value={property.quota_remainder_kind ?? "por_confirmar"}
        options={[
          { id: "por_confirmar", label: "Por confirmar / documentação incompleta" },
          { id: "externa", label: "Titulares externos à carteira, documentados" },
        ]}
        required
      />
      {owners.map((o) => (
        <label key={o.id} className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="confirmed" value={o.id} defaultChecked={o.confirmed} />
          {o.label} · quota verificada
        </label>
      ))}
    </Operation>
  );
}
