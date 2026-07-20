// Metodologia de Atrasos — ver PLANO.md §5 para a descrição narrativa.
// Funções PURAS (sem I/O): recebem contratos ativos + pagamentos + "hoje" e devolvem
// linhas por contrato + agregados. Pensado para ser testável (Vitest, P2-4 do PLANO.md)
// sem mocks de Supabase.
//
// Convenção de chaves de mês: "YYYY-MM-01" (mesmo formato de src/lib/format.ts —
// currentMonthKey/addMonthsKey/lastMonthsKeys/monthLabel), para reutilizar esses
// helpers sem conversões. `ref_month` dos pagamentos é normalizado para essa forma
// com toMonthKey() logo à entrada.

import { addMonthsKey, lastMonthsKeys, monthKeyFromDate } from "./format";
import type { Contract, Payment } from "./types";

// ---------- Parâmetros da metodologia ----------
/** Carência sobre o dia 1: um mês só conta como "devido" a partir deste dia. */
export const GRACE_DAYS = 8;
/** Tecto de meses usados na dívida estimada e no streak sem histórico (evita números absurdos). */
export const DEBT_CAP_MONTHS = 24;
/** Janela para detetar cadência própria (ex.: pagamento trimestral). */
export const CADENCE_WINDOW_MONTHS = 36;
/** Janela para "em falta (12m)" e para os défices de parciais que entram na dívida. */
export const MISSED_WINDOW_MONTHS = 12;
/** Abaixo disto considera-se "nenhum pagamento" (evita ruído de cêntimos). */
export const EPSILON_EUR = 1;

export type ArrearsSeverity = "ok" | "atencao" | "atraso" | "critico" | "ritmo_proprio";

/** Ordem de gravidade para ordenar a tabela (0 = mais grave). */
export const SEVERITY_RANK: Record<ArrearsSeverity, number> = {
  critico: 0,
  atraso: 1,
  atencao: 2,
  ritmo_proprio: 3,
  ok: 4,
};

export const SEVERITY_LABEL: Record<ArrearsSeverity, string> = {
  critico: "Crítico",
  atraso: "Atraso",
  atencao: "Atenção",
  ritmo_proprio: "Ritmo próprio",
  ok: "Em dia",
};

export type ArrearsContractInput = Pick<
  Contract,
  "id" | "rent" | "start_date" | "property_id" | "tenant_name" | "pf_contract_no"
>;

export type ArrearsPaymentInput = Pick<Payment, "contract_id" | "ref_month" | "amount">;

export type ArrearsMonthStatus = "pago" | "parcial" | "falta" | "antes_inicio";

export interface ArrearsMonthCell {
  month: string; // "YYYY-MM-01"
  status: ArrearsMonthStatus;
  paid: number;
  /** renda − pago, só > 0 quando status = "parcial". */
  deficit: number;
}

export interface ArrearsRow {
  contractId: string;
  propertyId: string;
  tenantName: string;
  pfContractNo: string | null;
  rent: number;
  startDate: string | null;
  /** Mês pago mais recente (qualquer, incl. futuro); null se nunca houve um mês totalmente pago. */
  lastPaidMonth: string | null;
  /** Meses consecutivos não totalmente pagos desde lastPaidMonth+1 até ao último mês devido. */
  streak: number;
  /** true só quando não existe NENHUM pagamento registado para o contrato. */
  semHistorico: boolean;
  /** Mediana (meses) do intervalo entre meses pagos consecutivos nos últimos 36m; null se não detetável. */
  cadence: number | null;
  severity: ArrearsSeverity;
  /** min(streak, 24) × renda + défices de meses parciais nos últimos 12 meses devidos. */
  debt: number;
  /** nº de meses totalmente em falta nos últimos 12 meses devidos (clampado ao início do contrato). */
  missed12: number;
  /** Últimos 24 meses devidos, célula a célula (para a grelha expansível). */
  months24: ArrearsMonthCell[];
}

export interface ArrearsMonthlyPoint {
  month: string; // "YYYY-MM-01"
  esperado: number;
  recebido: number;
}

export interface ArrearsWorstCase {
  contractId: string;
  propertyId: string;
  tenantName: string;
  streak: number;
}

export interface ArrearsSummary {
  /** nº de contratos com streak ≥ 1, EXCLUINDO os que estão dentro do próprio ritmo de pagamento. */
  contractsInArrears: number;
  /** Σ renda mensal dos contratos em atraso (contractsInArrears). */
  rentAtRisk: number;
  /** Σ dívida estimada dos contratos em atraso (contractsInArrears). */
  totalDebt: number;
  worst: ArrearsWorstCase | null;
  /** Últimos 12 meses (mês corrente incluído): esperado (aprox. renda atual) vs recebido (real). */
  monthly: ArrearsMonthlyPoint[];
}

// ---------- Helpers de mês (chave "YYYY-MM-01") ----------

/** Normaliza qualquer data ISO ("YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ssZ") para a chave do 1º dia do mês. */
function toMonthKey(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

function monthIndex(key: string): number {
  const y = parseInt(key.slice(0, 4), 10);
  const m = parseInt(key.slice(5, 7), 10);
  return y * 12 + (m - 1);
}

/** Nº de meses de `a` até `b` (positivo se b é posterior a a). */
function diffMonths(a: string, b: string): number {
  return monthIndex(b) - monthIndex(a);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Último mês devido: o mês corrente se hoje está a mais de GRACE_DAYS dias do dia 1
 * (i.e. getDate() > GRACE_DAYS), senão o mês anterior (o corrente ainda está em carência).
 */
export function lastDueMonthKey(today: Date): string {
  const current = monthKeyFromDate(today);
  return today.getDate() > GRACE_DAYS ? current : addMonthsKey(current, -1);
}

function severityFromStreak(streak: number): ArrearsSeverity {
  if (streak <= 0) return "ok";
  if (streak === 1) return "atencao";
  if (streak <= 3) return "atraso";
  return "critico";
}

/**
 * Mediana dos intervalos (meses) entre meses PAGOS consecutivos, na janela dos
 * últimos CADENCE_WINDOW_MONTHS terminando em lastDue. Só "conta" como cadência
 * própria se a mediana for ≥ 2 (pagamento mensal normal não é "cadência", é o padrão).
 */
function computeCadence(monthSums: Map<string, number>, rent: number, lastDue: string): number | null {
  const windowStart = addMonthsKey(lastDue, -(CADENCE_WINDOW_MONTHS - 1));
  const paidMonths = Array.from(monthSums.entries())
    .filter(([m, s]) => m >= windowStart && m <= lastDue && s >= rent - EPSILON_EUR)
    .map(([m]) => m)
    .sort();
  if (paidMonths.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < paidMonths.length; i++) {
    intervals.push(diffMonths(paidMonths[i - 1], paidMonths[i]));
  }
  const med = median(intervals);
  return med !== null && med >= 2 ? med : null;
}

/** Calcula a linha de atraso de UM contrato. Exportada para ser testável isoladamente. */
export function computeArrearsRow(
  contract: ArrearsContractInput,
  contractPayments: ArrearsPaymentInput[],
  lastDue: string,
): ArrearsRow {
  const rent = contract.rent;

  const monthSums = new Map<string, number>();
  for (const p of contractPayments) {
    const k = toMonthKey(p.ref_month);
    monthSums.set(k, (monthSums.get(k) ?? 0) + p.amount);
  }
  const hasAnyPayment = contractPayments.length > 0;

  // Mês pago mais recente — considera TODO o histórico, incl. meses futuros (pagamento
  // adiantado), para não classificar como "em atraso" quem já pagou à frente.
  let lastPaidMonth: string | null = null;
  for (const [k, s] of monthSums) {
    if (s >= rent - EPSILON_EUR && (lastPaidMonth === null || k > lastPaidMonth)) {
      lastPaidMonth = k;
    }
  }

  let streak: number;
  let semHistorico = false;

  if (lastPaidMonth !== null) {
    // Nunca é capado aqui — o streak real fica visível na UI; só a dívida estimada
    // (abaixo) aplica o tecto de DEBT_CAP_MONTHS.
    streak = lastPaidMonth >= lastDue ? 0 : diffMonths(lastPaidMonth, lastDue);
  } else {
    // Nunca houve um mês totalmente pago (pode haver parciais, ou nada). Sem uma âncora
    // fiável, conta-se desde o início do contrato, sempre capado a DEBT_CAP_MONTHS.
    semHistorico = !hasAnyPayment;
    if (contract.start_date) {
      const startMonth = toMonthKey(contract.start_date);
      const raw = diffMonths(startMonth, lastDue) + 1; // inclusive
      streak = Math.min(Math.max(raw, 0), DEBT_CAP_MONTHS);
    } else {
      streak = DEBT_CAP_MONTHS;
    }
  }

  const cadence = computeCadence(monthSums, rent, lastDue);
  const baseSeverity = severityFromStreak(streak);
  // Só reclassifica quando doutra forma já seria atenção/atraso/crítico — um contrato
  // 100% em dia (streak 0) fica "ok", não "ritmo próprio" (evita alarme visual falso).
  const cadenceApplies = cadence !== null && cadence >= 2 && streak >= 1 && streak <= cadence;
  const severity: ArrearsSeverity = cadenceApplies ? "ritmo_proprio" : baseSeverity;

  const startMonthKey = contract.start_date ? toMonthKey(contract.start_date) : null;

  const window12 = lastMonthsKeys(MISSED_WINDOW_MONTHS, lastDue).filter(
    (m) => !startMonthKey || m >= startMonthKey,
  );
  let missed12 = 0;
  let partialDeficit12 = 0;
  for (const m of window12) {
    const paid = monthSums.get(m) ?? 0;
    if (paid < EPSILON_EUR) missed12 += 1;
    else if (paid < rent - EPSILON_EUR) partialDeficit12 += rent - paid;
  }

  const debt = Math.min(streak, DEBT_CAP_MONTHS) * rent + partialDeficit12;

  const months24: ArrearsMonthCell[] = lastMonthsKeys(24, lastDue).map((m) => {
    if (startMonthKey && m < startMonthKey) {
      return { month: m, status: "antes_inicio", paid: 0, deficit: 0 };
    }
    const paid = monthSums.get(m) ?? 0;
    if (paid < EPSILON_EUR) return { month: m, status: "falta", paid, deficit: 0 };
    if (paid < rent - EPSILON_EUR) return { month: m, status: "parcial", paid, deficit: rent - paid };
    return { month: m, status: "pago", paid, deficit: 0 };
  });

  return {
    contractId: contract.id,
    propertyId: contract.property_id,
    tenantName: contract.tenant_name,
    pfContractNo: contract.pf_contract_no,
    rent,
    startDate: contract.start_date,
    lastPaidMonth,
    streak,
    semHistorico,
    cadence,
    severity,
    debt,
    missed12,
    months24,
  };
}

/**
 * Ponto de entrada principal: dado os contratos ativos e TODOS os pagamentos (histórico
 * completo — necessário para achar o último mês pago mesmo que seja há anos), devolve as
 * linhas por contrato e os agregados da página. `today` deve ser um Date real (não mockado
 * por fuso: usa getDate()/getMonth()/getFullYear() locais, iguais aos de format.ts).
 */
export function computeArrears(
  contracts: ArrearsContractInput[],
  payments: ArrearsPaymentInput[],
  today: Date,
): { rows: ArrearsRow[]; summary: ArrearsSummary } {
  const lastDue = lastDueMonthKey(today);

  const byContract = new Map<string, ArrearsPaymentInput[]>();
  const totalByMonth = new Map<string, number>();
  for (const p of payments) {
    const list = byContract.get(p.contract_id);
    if (list) list.push(p);
    else byContract.set(p.contract_id, [p]);

    const k = toMonthKey(p.ref_month);
    totalByMonth.set(k, (totalByMonth.get(k) ?? 0) + p.amount);
  }

  const rows = contracts.map((c) => computeArrearsRow(c, byContract.get(c.id) ?? [], lastDue));

  const inArrears = rows.filter((r) => r.streak >= 1 && r.severity !== "ritmo_proprio");
  const rentAtRisk = inArrears.reduce((acc, r) => acc + r.rent, 0);
  const totalDebt = inArrears.reduce((acc, r) => acc + r.debt, 0);
  const worstRow = inArrears.reduce<ArrearsRow | null>(
    (acc, r) => (!acc || r.streak > acc.streak ? r : acc),
    null,
  );

  const totalRent = contracts.reduce((acc, c) => acc + c.rent, 0);
  const months = lastMonthsKeys(12, monthKeyFromDate(today));
  const monthly: ArrearsMonthlyPoint[] = months.map((m) => ({
    month: m,
    esperado: totalRent,
    recebido: totalByMonth.get(m) ?? 0,
  }));

  return {
    rows,
    summary: {
      contractsInArrears: inArrears.length,
      rentAtRisk,
      totalDebt,
      worst: worstRow
        ? {
            contractId: worstRow.contractId,
            propertyId: worstRow.propertyId,
            tenantName: worstRow.tenantName,
            streak: worstRow.streak,
          }
        : null,
      monthly,
    },
  };
}
