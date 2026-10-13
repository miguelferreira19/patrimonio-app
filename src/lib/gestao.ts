import { contractActiveInMonth } from "./calc";
import { endOfMonthISO } from "./format";
import { parseAmount } from "./parse";
import { eData, exigir, eNumero } from "./validar";
import type { Contract, Expense, Landlord, PaymentMethod, PropertyOwner, Receipt, RentUpdate } from "./types";

export type Ambito = "inteiro" | "carteira" | "proprietario";
export const AMBITO_LABEL: Record<Ambito, string> = {
  inteiro: "Imóvel por inteiro", carteira: "Parte dos proprietários da carteira", proprietario: "Parte do proprietário selecionado",
};
export type PaymentState = "confirmado" | "parcial" | "por_confirmar" | "dados_por_importar" | "saldo_vencido_confirmado" | "nao_vencido" | "sem_contrato";
export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  confirmado: "Pagamento confirmado", parcial: "Pagamento parcial", por_confirmar: "Pagamento por confirmar",
  dados_por_importar: "Dados por importar", saldo_vencido_confirmado: "Saldo vencido confirmado", nao_vencido: "Período ainda não vencido", sem_contrato: "Período sem contrato",
};
export type CaseKind = "cobranca" | "tarefa" | "manutencao" | "vaga";
export type CaseStatus = "aberto" | "em_curso" | "adiado" | "concluido";
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = { aberto: "Aberto", em_curso: "Em curso", adiado: "Adiado", concluido: "Concluído" };
export const AVAILABILITY_LABEL = { disponivel: "Disponível", em_obras: "Em obras", uso_proprio: "Uso próprio", reservado: "Reservado", indisponivel: "Indisponível" };
export interface PaymentMovement {
  id: string; contract_id: string; amount: number; received_date: string | null; method: PaymentMethod;
  reference: string | null; proof_path: string | null; notes: string | null; voided: boolean; void_reason: string | null;
  request_id: string; created_at: string; created_by: string | null;
}
export interface PaymentAllocation { movement_id: string; ref_month: string; amount: number }
export interface PeriodConfirmation { contract_id: string; ref_month: string; expected_amount: number; note: string; confirmed_at: string; confirmed_by: string | null }
export interface ManagementCase {
  id: string; kind: CaseKind; property_id: string | null; contract_id: string | null; title: string;
  description: string | null; status: CaseStatus; responsible: string | null; due_date: string | null; next_step: string | null;
  priority: "baixa" | "normal" | "alta" | "urgente"; supplier: string | null; budget: number | null; approved_budget: number | null;
  availability_state: keyof typeof AVAILABILITY_LABEL | null; available_from: string | null; vacancy_start: string | null; vacancy_end: string | null;
  target_rent: number | null; preparation: string | null; listing_url: string | null; document_paths: string[];
  request_id: string; created_by: string | null; created_at: string; updated_at: string;
}
export interface ManagementEvent { id: string; case_id: string; kind: "nota" | "contacto" | "acordo" | "visita"; occurred_on: string; note: string; next_step: string | null; due_date: string | null; created_at: string }
export interface OperationHistory { id: number; entity_table: string; entity_id: string; action: string; before_data: Record<string, unknown> | null; after_data: Record<string, unknown> | null; note: string | null; created_at: string }
export interface MonthStatement {
  month: string; contracted: number; expected: number; confirmed: number; documented: number; recorded: number;
  pending: number; confirmedBalance: number | null; credit: number; status: PaymentState;
  receiptState: "emitido" | "por_emitir" | "por_importar"; origin: string; coverage: string | null;
  rentInferred: boolean; partialMonth: boolean; confirmation: PeriodConfirmation | null;
}
export function cents(value: number): number { return Math.round(value * 100); }
export function validMonth(value: string): boolean { return eData(value) && value.endsWith("-01"); }
export function monthsBetween(from: string, to: string): string[] {
  exigir(validMonth(from) && validMonth(to) && from <= to, "Escolhe um intervalo de meses válido.");
  const out: string[] = []; const d = new Date(from + "T12:00:00Z");
  while (d.toISOString().slice(0, 10) <= to) {
    out.push(d.toISOString().slice(0, 10)); exigir(out.length <= 120, "O intervalo não pode exceder 120 meses."); d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}
export function parseAllocations(text: string, total: number): Array<{ ref_month: string; amount: number }> {
  exigir(eNumero(total) && total > 0 && cents(total) / 100 === total, "Indica um montante positivo com até dois cêntimos.");
  const seen = new Set<string>();
  const parts = text.split(/\r?\n/).filter((s) => s.trim()).map((line) => {
    const match = /^\s*(\d{4}-\d{2})\s*=\s*(.+?)\s*$/.exec(line);
    exigir(match, "Usa uma linha por mês: AAAA-MM = montante.");
    const ref_month = match[1] + "-01"; const amount = parseAmount(match[2]);
    exigir(validMonth(ref_month), "Há um mês inválido na repartição."); exigir(!seen.has(ref_month), "O mesmo mês aparece duas vezes."); seen.add(ref_month);
    exigir(amount !== null && amount > 0 && cents(amount) / 100 === amount, "Cada parcela deve ser positiva e ter até dois cêntimos.");
    return { ref_month, amount };
  });
  exigir(parts.length > 0 && parts.length <= 120, "Indica entre 1 e 120 meses.");
  exigir(parts.reduce((n, p) => n + cents(p.amount), 0) === cents(total), "As parcelas não somam o montante recebido.");
  return parts;
}
export function shareOf(propertyId: string, owners: PropertyOwner[], landlords: Landlord[], scope: Ambito, landlordId?: string): number | null {
  if (scope === "inteiro") return 1;
  const eligible = new Set(landlords.filter((l) => l.in_portfolio !== false).map((l) => l.id));
  const rows = owners.filter((o) => o.property_id === propertyId && (scope === "proprietario" ? o.landlord_id === landlordId : eligible.has(o.landlord_id)));
  if (!rows.length) return null;
  return Math.min(1, rows.reduce((n, o) => n + Number(o.quota), 0) / 100);
}
export function scopedExpense(expense: Expense, owners: PropertyOwner[], landlords: Landlord[], scope: Ambito, landlordId?: string): { amount: number | null; estimated: boolean } {
  if (!expense.property_id) return { amount: scope === "proprietario" && expense.landlord_id !== landlordId ? null : Number(expense.amount), estimated: expense.origem !== "registada" };
  const share = shareOf(expense.property_id, owners, landlords, scope, landlordId);
  if (share === null) return { amount: null, estimated: false };
  if (!expense.landlord_id) return { amount: cents(Number(expense.amount) * share) / 100, estimated: expense.origem !== "registada" };
  if (scope === "proprietario" && expense.landlord_id === landlordId) return { amount: Number(expense.amount), estimated: expense.origem !== "registada" };
  const quota = owners.find((o) => o.property_id === expense.property_id && o.landlord_id === expense.landlord_id)?.quota;
  if (!quota || quota <= 0) return { amount: null, estimated: false };
  return { amount: cents(Number(expense.amount) / (Number(quota) / 100) * share) / 100, estimated: true };
}
export function rentInMonth(contract: Contract, updates: RentUpdate[], month: string, today: string): { rent: number; inferred: boolean } {
  const changes = updates.filter((u) => u.contract_id === contract.id).sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  const applicable = changes.filter((u) => u.effective_date <= endOfMonthISO(month)).at(-1);
  if (applicable) return { rent: Number(applicable.new_rent), inferred: false };
  if (changes[0]?.old_rent != null) return { rent: Number(changes[0].old_rent), inferred: false };
  return { rent: Number(contract.rent), inferred: month.slice(0, 7) < today.slice(0, 7) };
}
export function monthStatement(input: {
  contract: Contract; month: string; today: string; horizon: string | null; updates: RentUpdate[];
  receipts: Receipt[]; movements: PaymentMovement[]; allocations: PaymentAllocation[]; confirmations: PeriodConfirmation[];
}): MonthStatement {
  const { contract, month, today, horizon } = input;
  const rent = rentInMonth(contract, input.updates, month, today);
  const docs = input.receipts.filter((r) => r.contract_id === contract.id && r.ref_month === month && !r.cancelled);
  const movementIds = new Set(input.movements.filter((m) => m.contract_id === contract.id && !m.voided).map((m) => m.id));
  const parts = input.allocations.filter((a) => movementIds.has(a.movement_id) && a.ref_month === month);
  const confirmed = parts.reduce((s, a) => s + cents(Number(a.amount)), 0) / 100;
  const documented = docs.reduce((s, r) => s + cents(Number(r.amount) - Number(r.withholding)), 0) / 100;
  const active = contractActiveInMonth(contract, month);
  const confirmation = input.confirmations.find((c) => c.contract_id === contract.id && c.ref_month === month) ?? null;
  const withholding = docs.reduce((n, r) => n + cents(Number(r.withholding)), 0) / 100;
  const expected = confirmation ? Number(confirmation.expected_amount) : active ? Math.max(0, rent.rent - withholding) : 0;
  const recorded = parts.length > 0 ? confirmed : documented;
  const pending = Math.max(0, cents(expected) - cents(recorded)) / 100;
  const due = `${month.slice(0, 8)}${String(Math.min(contract.due_day, Number(endOfMonthISO(month).slice(8, 10)))).padStart(2, "0")}`;
  const balance = confirmation && due <= today ? Math.max(0, cents(expected) - cents(confirmed)) / 100 : null;
  let status: PaymentState = "por_confirmar";
  if (!active && !confirmation) status = "sem_contrato";
  else if (balance !== null && balance > 0) status = "saldo_vencido_confirmado";
  else if (parts.length && cents(confirmed) >= cents(expected)) status = "confirmado";
  else if (parts.length) status = "parcial";
  else if (due > today) status = "nao_vencido";
  else if (!docs.length && (!horizon || month > horizon)) status = "dados_por_importar";
  return { month, contracted: rent.rent, expected, confirmed, documented, recorded, pending, confirmedBalance: balance,
    credit: Math.max(0, cents(confirmed) - cents(expected)) / 100, status,
    receiptState: docs.length ? "emitido" : (!horizon || month > horizon) ? "por_importar" : "por_emitir",
    origin: parts.length ? "Movimento confirmado pelo administrador" : docs.length ? "Inferido dos recibos; pagamento por confirmar" : "Sem confirmação de pagamento",
    coverage: horizon, rentInferred: rent.inferred,
    partialMonth: Boolean((contract.start_date && contract.start_date > month && contract.start_date <= endOfMonthISO(month)) || (contract.end_date && contract.end_date >= month && contract.end_date < endOfMonthISO(month))), confirmation };
}
export function receiptCandidates(receipt: Receipt, contracts: Contract[]): Array<{ contract: Contract; reason: string }> {
  const exact = receipt.pf_contract_no ? contracts.filter((c) => c.pf_contract_no === receipt.pf_contract_no) : [];
  if (exact.length) return exact.map((contract) => ({ contract, reason: "Número de contrato igual ao do recibo" }));
  return contracts.filter((c) => receipt.property_id && c.property_id === receipt.property_id && contractActiveInMonth(c, receipt.ref_month)).map((contract) => ({ contract, reason: "Mesmo imóvel e período; confirmar o inquilino" }));
}
export function declaredContractDates(contract: Contract): Array<{ date: string; label: string }> {
  if (contract.term_kind !== "prazo_certo" || !contract.expected_end_date || !contract.terms_confirmed_at || !contract.term_source?.trim()) return [];
  const out = [{ date: contract.expected_end_date, label: "Fim previsto confirmado no contrato" }];
  if (contract.notice_days_landlord != null) {
    const d = new Date(contract.expected_end_date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - contract.notice_days_landlord);
    out.push({ date: d.toISOString().slice(0, 10), label: "Pré-aviso do proprietário indicado no contrato" });
  }
  return out;
}
