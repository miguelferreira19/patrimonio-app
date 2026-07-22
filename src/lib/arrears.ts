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
/** Janela para "em falta (12m)". */
export const MISSED_WINDOW_MONTHS = 12;
/** Abaixo disto considera-se "nenhum pagamento" (evita ruído de cêntimos). */
export const EPSILON_EUR = 1;
/** Janela para calibrar a renda de referência a partir dos pagamentos reais. */
export const REFERENCE_WINDOW_MONTHS = 24;
/** Fração da renda de referência a partir da qual o mês conta como liquidado. */
export const PAID_TOLERANCE = 0.9;
/** Acima disto o contrato é tratado como provavelmente cessado sem baixa (não soma dívida). */
export const STALE_MONTHS = 12;

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
  /** Valor efetivamente esperado por mês — ver referenceRent(). Pode ser < rent (retenção na
   *  fonte, atualização de renda ainda não refletida nos recibos). É esta a base de comparação. */
  expectedRent: number;
  /** true quando streak > STALE_MONTHS: contrato provavelmente cessado sem baixa na app. */
  stale: boolean;
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

/** Normaliza qualquer data ISO ("YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ssZ") para a chave do 1º dia do mês.
 *  Exportada para reutilização fora deste módulo (ex.: histórico de pagamentos da fração) — a
 *  mesma normalização, sem duplicar a regra. */
export function toMonthKey(dateStr: string): string {
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
 * Último mês devido pelo CALENDÁRIO: o mês corrente se hoje está a mais de GRACE_DAYS dias
 * do dia 1 (i.e. getDate() > GRACE_DAYS), senão o mês anterior (ainda em carência).
 */
export function lastDueMonthKey(today: Date): string {
  const current = monthKeyFromDate(today);
  return today.getDate() > GRACE_DAYS ? current : addMonthsKey(current, -1);
}

/**
 * Último mês para o qual EXISTEM DADOS na carteira — o mês mais recente (não futuro) com
 * algum pagamento registado. Os recibos são importados em lote para toda a família de cada
 * vez (pipeline dados/, ver PLANO.md §4); enquanto o mês corrente não é importado, cobrar
 * atraso por ele transformava "recibo ainda não importado" em dívida falsa para TODOS os
 * contratos ativos. É esta a causa de fundo dos falsos positivos (ex.: RCFDT).
 *
 * Nunca ultrapassa o último mês devido pelo calendário. Devolve null se não há pagamento
 * nenhum na carteira — aí não há horizonte e usa-se o do calendário.
 *
 * Robustez: como o import é em lote, o mês-máximo vem preenchido por dezenas de contratos,
 * não por um pagamento adiantado isolado. Um inquilino que deixou mesmo de pagar continua
 * apanhado — os OUTROS contratos empurram o horizonte para a frente e o último mês pago dele
 * fica muito atrás.
 */
export function dataHorizonMonth(payments: ArrearsPaymentInput[], today: Date): string | null {
  const cap = lastDueMonthKey(today);
  let max: string | null = null;
  for (const p of payments) {
    const k = toMonthKey(p.ref_month);
    if (k <= cap && (max === null || k > max)) max = k;
  }
  return max;
}

/**
 * Renda de REFERÊNCIA do contrato: o que este inquilino efetivamente costuma pagar por mês.
 *
 * `contracts.rent` é um escalar com o valor de HOJE e em BRUTO, mas os pagamentos são cash
 * líquido e histórico. Comparar os dois faz meses perfeitamente pagos parecerem em falta —
 * e quando NENHUM mês atinge a renda atual, o cálculo caía no ramo "sem mês pago" e inventava
 * `24 × renda` de dívida. Duas causas reais nos dados da família:
 *   1. retenção na fonte de 25% (inquilinos-empresa): recibo de 600 €, pagamento de 450 €;
 *   2. atualizações de renda: histórico a 260/266/284/290 com `contracts.rent` já a 296.
 *
 * A mediana dos meses com pagamento absorve as duas sem precisar de `rent_updates` nem de
 * uma coluna `withholding` em `receipts` (nenhuma das duas está preenchida hoje). É robusta
 * a meses proporcionais de início/fim de contrato, que a média ou o mínimo estragariam.
 *
 * ponytail: teto conhecido — normaliza quem paga sistematicamente a menos do que devia (250
 * de uma renda de 300 passa a "em dia"). Por isso NUNCA sobe acima de `rent` e a UI mostra
 * "contratado X · recebido Y": o desvio deixa de ser dívida e passa a facto visível. Quando o
 * P2-2 (IRS) importar a retenção real, a referência passa a sair do dado em vez da mediana.
 */
export function referenceRent(monthSums: Map<string, number>, rent: number, lastDue: string): number {
  const windowStart = addMonthsKey(lastDue, -(REFERENCE_WINDOW_MONTHS - 1));
  const values = Array.from(monthSums.entries())
    .filter(([m, s]) => m >= windowStart && m <= lastDue && s >= EPSILON_EUR)
    .map(([, s]) => s);
  const med = median(values);
  return med === null ? rent : Math.min(rent, med);
}

/** Mês liquidado: recebido dentro da banda de tolerância da renda de referência.
 *  Partilhado com a página da fração para as duas vistas não se contradizerem. */
export function isMonthSettled(paid: number, expected: number): boolean {
  return paid >= expected * PAID_TOLERANCE && paid >= EPSILON_EUR;
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
function computeCadence(monthSums: Map<string, number>, expected: number, lastDue: string): number | null {
  const windowStart = addMonthsKey(lastDue, -(CADENCE_WINDOW_MONTHS - 1));
  const paidMonths = Array.from(monthSums.entries())
    .filter(([m, s]) => m >= windowStart && m <= lastDue && isMonthSettled(s, expected))
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
  const expectedRent = referenceRent(monthSums, rent, lastDue);

  // Mês pago mais recente — considera TODO o histórico, incl. meses futuros (pagamento
  // adiantado), para não classificar como "em atraso" quem já pagou à frente.
  let lastPaidMonth: string | null = null;
  for (const [k, s] of monthSums) {
    if (isMonthSettled(s, expectedRent) && (lastPaidMonth === null || k > lastPaidMonth)) {
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

  const cadence = computeCadence(monthSums, expectedRent, lastDue);
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
  for (const m of window12) {
    if ((monthSums.get(m) ?? 0) < EPSILON_EUR) missed12 += 1;
  }

  // Sem recibos há mais de STALE_MONTHS: quase sempre é um contrato que acabou e ficou por
  // dar baixa (ex.: inquilino saiu em 2021 e o status continua "ativo"). Somar-lhe 24 meses
  // de renda é ficção e domina os KPIs — fica visível na lista com a flag, mas a zero.
  const stale = streak > STALE_MONTHS;
  // Só o streak — os meses parciais JÁ contam aqui como mês inteiro em falta; somar-lhes
  // também o défice contava o mesmo mês duas vezes (renda + o que faltou dessa renda).
  const debt = stale ? 0 : Math.min(streak, DEBT_CAP_MONTHS) * expectedRent;

  const months24: ArrearsMonthCell[] = lastMonthsKeys(24, lastDue).map((m) => {
    if (startMonthKey && m < startMonthKey) {
      return { month: m, status: "antes_inicio", paid: 0, deficit: 0 };
    }
    const paid = monthSums.get(m) ?? 0;
    if (paid < EPSILON_EUR) return { month: m, status: "falta", paid, deficit: 0 };
    if (!isMonthSettled(paid, expectedRent)) {
      return { month: m, status: "parcial", paid, deficit: expectedRent - paid };
    }
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
    expectedRent,
    stale,
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
  // O último mês devido é limitado ao horizonte de dados: nunca cobrar atraso por meses que
  // a família ainda não importou (ver dataHorizonMonth). Sem dados nenhuns, cai no calendário.
  const lastDue = dataHorizonMonth(payments, today) ?? lastDueMonthKey(today);

  const contractIds = new Set(contracts.map((c) => c.id));
  const byContract = new Map<string, ArrearsPaymentInput[]>();
  const totalByMonth = new Map<string, number>();
  for (const p of payments) {
    const list = byContract.get(p.contract_id);
    if (list) list.push(p);
    else byContract.set(p.contract_id, [p]);

    // Só os contratos analisados (ativos): o `recebido` do gráfico tem de cobrir exatamente
    // o mesmo universo que o `esperado`, senão entra dinheiro de contratos já cessados.
    if (contractIds.has(p.contract_id)) {
      const k = toMonthKey(p.ref_month);
      totalByMonth.set(k, (totalByMonth.get(k) ?? 0) + p.amount);
    }
  }

  const rows = contracts.map((c) => computeArrearsRow(c, byContract.get(c.id) ?? [], lastDue));

  const inArrears = rows.filter((r) => r.streak >= 1 && r.severity !== "ritmo_proprio");
  const rentAtRisk = inArrears.reduce((acc, r) => acc + r.expectedRent, 0);
  const totalDebt = inArrears.reduce((acc, r) => acc + r.debt, 0);
  const worstRow = inArrears.reduce<ArrearsRow | null>(
    (acc, r) => (!acc || r.streak > acc.streak ? r : acc),
    null,
  );

  // Termina no horizonte de dados (mesmo critério do atraso): o mês corrente tem recibos por
  // emitir e os meses ainda não importados desenhavam um penhasco falso no fim do gráfico.
  const monthly: ArrearsMonthlyPoint[] = lastMonthsKeys(12, lastDue).map((m) => ({
    month: m,
    // Esperado mês a mês, e em renda de REFERÊNCIA: com a renda de hoje aplicada a todos os
    // meses, contratos que ainda não existiam e a retenção na fonte abriam um gap permanente
    // de milhares de euros que não era atraso nenhum.
    esperado: rows.reduce(
      (acc, r) => acc + (!r.startDate || toMonthKey(r.startDate) <= m ? r.expectedRent : 0),
      0,
    ),
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
