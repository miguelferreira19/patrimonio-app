export type TipoDeEvento = "contacto" | "promessa" | "carta" | "nota" | "pagamento" | "recibo";

export type EventoDoDiario = {
  id: string;
  contratoId: string;
  dia: string;
  tipo: TipoDeEvento;
  texto: string;
  autor: string | null;
  valor?: number;
  prometidoPara?: string;
};

export type FontesDoDiario = {
  eventos: Array<{
    id: string; contract_id: string | null;
    kind: "contacto" | "promessa" | "carta" | "nota" | "acordo" | "visita";
    occurred_on: string; note: string; due_date?: string | null;
    amount?: number | null; autor: string | null;
  }>;
  movimentos: Array<{
    id: string; contract_id: string; received_date: string | null; created_at: string;
    amount: number; notes: string | null; voided: boolean; autor: string | null;
  }>;
  recibos: Array<{
    id: string; contract_id: string | null; issue_date: string | null;
    receipt_number: string | null; amount: number; withholding: number; cancelled?: boolean;
  }>;
};

const ORDEM: Record<TipoDeEvento, number> = {
  promessa: 0, contacto: 1, carta: 2, nota: 3, pagamento: 4, recibo: 5,
};

function comparar(a: EventoDoDiario, b: EventoDoDiario): number {
  return b.dia.localeCompare(a.dia) || ORDEM[a.tipo] - ORDEM[b.tipo] || a.id.localeCompare(b.id);
}

export function diarioDoInquilino(contratoIds: string[], fontes: FontesDoDiario): EventoDoDiario[] {
  const ids = new Set(contratoIds);
  const diario: EventoDoDiario[] = [];
  for (const e of fontes.eventos) {
    if (!e.contract_id || !ids.has(e.contract_id)) continue;
    const tipo = e.kind === "acordo" || e.kind === "visita" ? "contacto" : e.kind;
    diario.push({
      id: e.id, contratoId: e.contract_id, dia: e.occurred_on, tipo, texto: e.note, autor: e.autor,
      ...(tipo === "promessa" && e.amount != null ? { valor: e.amount } : {}),
      ...(tipo === "promessa" && e.due_date ? { prometidoPara: e.due_date } : {}),
    });
  }
  for (const m of fontes.movimentos) {
    if (m.voided || !ids.has(m.contract_id)) continue;
    diario.push({
      id: m.id, contratoId: m.contract_id, dia: m.received_date ?? m.created_at.slice(0, 10),
      tipo: "pagamento", texto: m.notes || "Pagamento registado", autor: m.autor, valor: m.amount,
    });
  }
  for (const r of fontes.recibos) {
    if (r.cancelled || !r.contract_id || !ids.has(r.contract_id) || !r.issue_date) continue;
    diario.push({
      id: r.id, contratoId: r.contract_id, dia: r.issue_date, tipo: "recibo",
      texto: r.receipt_number ? `Recibo ${r.receipt_number}` : "Recibo emitido",
      autor: "Portal das Finanças", valor: r.amount - r.withholding,
    });
  }
  return diario.sort(comparar);
}

export function promessasPorCumprir(diario: EventoDoDiario[], hoje: string): EventoDoDiario[] {
  const ultimoPagamento = new Map<string, string>();
  for (const e of diario) {
    if (e.tipo !== "pagamento" && e.tipo !== "recibo") continue;
    if (e.dia > (ultimoPagamento.get(e.contratoId) ?? "")) ultimoPagamento.set(e.contratoId, e.dia);
  }
  return diario.filter((e) => e.tipo === "promessa" && !!e.prometidoPara && e.prometidoPara < hoje
    && (ultimoPagamento.get(e.contratoId) ?? "") < e.dia);
}

export function ultimoContacto(diario: EventoDoDiario[]): EventoDoDiario | null {
  return diario.filter((e) => e.tipo === "contacto").sort(comparar)[0] ?? null;
}
