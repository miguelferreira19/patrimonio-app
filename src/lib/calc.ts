// Cálculos de negócio: rendas esperadas, desvios ao mercado, yields.
import type { Contract, Expense, MarketBenchmark, Payment, Property, RentUpdate, UpdateCoefficient } from "./types";
import { endOfMonthISO } from "./format";

/**
 * Um contrato conta para um mês se já tinha começado até ao fim do mês e
 * não tinha terminado antes do início do mês.
 * Nota v1: a renda "esperada" de meses passados usa a renda ATUAL do contrato
 * (não reconstruímos rent_updates mês a mês — os valores reais estão em payments/receipts).
 */
export function contractActiveInMonth(c: Contract, monthKey: string): boolean {
  const mStart = monthKey;
  const mEnd = endOfMonthISO(monthKey);
  if (c.start_date && c.start_date > mEnd) return false;
  if (c.end_date && c.end_date < mStart) return false;
  if (!c.end_date && c.status === "cessado") return false;
  return true;
}

export interface MonthRollRow {
  contract: Contract;
  property: Property | undefined;
  expected: number;
  payment: Payment | undefined;
}

/** Rent roll de um mês: contratos ativos com o respetivo pagamento (ou falta dele). */
export function monthRoll(
  monthKey: string,
  contracts: Contract[],
  payments: Payment[],
  propertiesById: Map<string, Property>,
): MonthRollRow[] {
  const payByContract = new Map(
    payments.filter((p) => p.ref_month.slice(0, 7) === monthKey.slice(0, 7)).map((p) => [p.contract_id, p]),
  );
  return contracts
    .filter((c) => contractActiveInMonth(c, monthKey))
    .map((c) => ({
      contract: c,
      property: propertiesById.get(c.property_id),
      expected: c.rent,
      payment: payByContract.get(c.id),
    }));
}

/**
 * Benchmark aplicável a uma fração para uma métrica (renda ou venda):
 * primeiro a freguesia (dicofre exato), na falta o concelho (prefixo do dicofre).
 * Rendas e vendas podem vir de períodos diferentes do INE, daí a procura por métrica.
 */
export function benchmarkForMetric(
  property: Property,
  benchmarks: MarketBenchmark[],
  metric: "rent" | "sale",
): MarketBenchmark | undefined {
  if (!property.dicofre) return undefined;
  const has = (b: MarketBenchmark) =>
    metric === "rent" ? b.rent_median_m2 !== null && b.rent_median_m2 !== undefined
                      : b.sale_median_m2 !== null && b.sale_median_m2 !== undefined;
  const freg = benchmarks
    .filter((b) => b.level === "freguesia" && b.dicofre === property.dicofre && has(b))
    .sort((a, b) => b.period.localeCompare(a.period));
  if (freg.length > 0) return freg[0];
  const conc = benchmarks
    .filter((b) => b.level === "concelho" && property.dicofre!.startsWith(b.dicofre) && has(b))
    .sort((a, b) => b.period.localeCompare(a.period));
  return conc[0];
}

export interface MarketView {
  rentPerM2: number | null;       // renda atual €/m²
  benchmarkRentM2: number | null; // mediana INE €/m² (novos contratos)
  deviation: number | null;       // ex.: -0.20 = 20% abaixo do mercado
  gapEurMonth: number | null;     // € por mês "na mesa" se abaixo do mercado
  estimatedValue: number | null;  // área × mediana de venda €/m²
  grossYield: number | null;      // renda anual / valor estimado
  benchmark: MarketBenchmark | undefined;
}

export function marketView(
  property: Property,
  activeContract: Contract | undefined,
  benchmarks: MarketBenchmark[],
): MarketView {
  const rentBench = benchmarkForMetric(property, benchmarks, "rent");
  const saleBench = benchmarkForMetric(property, benchmarks, "sale");
  const area = property.area_m2 && property.area_m2 > 0 ? property.area_m2 : null;
  const rent = activeContract?.rent ?? null;

  const rentPerM2 = rent !== null && area ? rent / area : null;
  const benchmarkRentM2 = rentBench?.rent_median_m2 ?? null;
  const deviation =
    rentPerM2 !== null && benchmarkRentM2 ? rentPerM2 / benchmarkRentM2 - 1 : null;
  const gapEurMonth =
    deviation !== null && deviation < 0 && area && benchmarkRentM2 && rent !== null
      ? benchmarkRentM2 * area - rent
      : null;
  const estimatedValue = area && saleBench?.sale_median_m2 ? area * saleBench.sale_median_m2 : null;
  const grossYield =
    rent !== null && estimatedValue ? (rent * 12) / estimatedValue : null;

  return {
    rentPerM2,
    benchmarkRentM2,
    deviation,
    gapEurMonth,
    estimatedValue,
    grossYield,
    benchmark: rentBench ?? saleBench,
  };
}

/** Soma de despesas de um mês (chave YYYY-MM). */
export function expensesInMonth(expenses: Expense[], monthKey: string): Expense[] {
  const ym = monthKey.slice(0, 7);
  return expenses.filter((e) => e.expense_date.slice(0, 7) === ym);
}

export function sum(values: Array<number | null | undefined>): number {
  let t = 0;
  for (const v of values) t += v ?? 0;
  return t;
}

export interface RentEligibility {
  eligible: boolean;
  baseDate: string | null; // último rent_update ou início do contrato — data-base da contagem
  eligibleSince: string | null; // baseDate + 12 meses
  suggestedRent: number | null; // renda × coeficiente do ano mais recente
}

/**
 * Elegibilidade para aplicar o coeficiente anual (P1-1): só 12 meses depois da
 * última atualização de renda (ou do início do contrato, na falta de uma).
 */
export function rentUpdateEligibility(
  contract: Contract,
  rentUpdates: RentUpdate[],
  coefficients: UpdateCoefficient[],
  todayISO: string,
): RentEligibility {
  const lastUpdate = rentUpdates
    .filter((u) => u.contract_id === contract.id)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
  const baseDate = lastUpdate?.effective_date ?? contract.start_date ?? null;
  if (!baseDate) return { eligible: false, baseDate: null, eligibleSince: null, suggestedRent: null };

  const base = new Date(baseDate);
  base.setMonth(base.getMonth() + 12);
  const eligibleSince = base.toISOString().slice(0, 10);

  const latestCoef = coefficients.slice().sort((a, b) => b.year - a.year)[0];
  const suggestedRent = latestCoef ? Math.round(contract.rent * latestCoef.coefficient * 100) / 100 : null;

  return { eligible: todayISO >= eligibleSince, baseDate, eligibleSince, suggestedRent };
}

export interface VacancyGap {
  propertyId: string;
  gapStart: string; // dia seguinte ao fim do contrato anterior
  gapEnd: string | null; // início do contrato seguinte, ou null se ainda vago hoje
  days: number;
  lostRent: number; // renda do contrato anterior × meses do vazio (30 dias/mês)
}

/**
 * Vazios entre contratos por fração (P2-9): ordena os contratos de cada fração por início e
 * procura folgas entre o fim de um e o início do seguinte. Um vazio sem contrato seguinte
 * (fração ainda hoje sem contrato ativo) conta como aberto (`gapEnd: null`) até `todayISO`.
 * Precisa de `end_date` no contrato anterior — sem ele não há como saber onde começa o vazio.
 */
export function vacancyGaps(contracts: Contract[], todayISO: string): VacancyGap[] {
  const byProperty = new Map<string, Contract[]>();
  for (const c of contracts) {
    const list = byProperty.get(c.property_id) ?? [];
    list.push(c);
    byProperty.set(c.property_id, list);
  }

  const gaps: VacancyGap[] = [];
  for (const [propertyId, list] of byProperty) {
    const sorted = list.slice().sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
    for (let i = 0; i < sorted.length; i++) {
      const prev = sorted[i];
      if (!prev.end_date) continue; // ainda ativo ou sem data de fim registada — não é vazio conhecido
      const gapStartDate = new Date(prev.end_date);
      gapStartDate.setDate(gapStartDate.getDate() + 1);
      const gapStart = gapStartDate.toISOString().slice(0, 10);

      const next = sorted[i + 1];
      const gapEnd = next?.start_date ?? null;
      if (gapEnd !== null && gapEnd <= gapStart) continue; // sem folga real (renovação same-day)

      const endForCalc = gapEnd ?? todayISO;
      if (endForCalc <= gapStart) continue; // vazio "aberto" que ainda não teve nenhum dia (fim=hoje)
      const days = Math.round((new Date(endForCalc).getTime() - new Date(gapStart).getTime()) / 86400000);
      const lostRent = Math.round((days / 30) * prev.rent * 100) / 100;

      gaps.push({ propertyId, gapStart, gapEnd, days, lostRent });
    }
  }
  return gaps;
}

/**
 * Contratos ativos cuja data de fim cai dentro de `horizonDays` (P2-8, só o alerta — sem gerar
 * carta nem calcular prazos legais de denúncia/renovação, que dependem do tipo/duração do
 * contrato e não estão modelados aqui). Ordenado por data de fim mais próxima primeiro.
 */
export function upcomingContractEnds(
  contracts: Contract[],
  todayISO: string,
  horizonDays = 90,
): Contract[] {
  const horizon = new Date(todayISO);
  horizon.setDate(horizon.getDate() + horizonDays);
  const horizonISO = horizon.toISOString().slice(0, 10);
  return contracts
    .filter((c) => c.status === "ativo" && c.end_date && c.end_date >= todayISO && c.end_date <= horizonISO)
    .sort((a, b) => a.end_date!.localeCompare(b.end_date!));
}

/**
 * P0-2c: terrenos (não arrendáveis) e imóveis vendidos saem de todas as métricas
 * correntes (ocupação, potencial de mercado, atrasos, saúde dos dados) — o histórico
 * de contratos/recibos fica na BD, só deixa de contar para os números de hoje.
 */
// Aceita `Pick<Property, "status">` (não só `Property` inteiro) para servir também
// leituras parciais do Supabase que só pedem as colunas de que precisam (ex.: atrasos).
export function isCurrentProperty(p: Pick<Property, "status">): boolean {
  return p.status !== "terreno" && p.status !== "vendido";
}

export function currentProperties<T extends Pick<Property, "status">>(list: T[]): T[] {
  return list.filter(isCurrentProperty);
}

/** Lista de territórios (freguesias/concelhos) disponível nos benchmarks, para o formulário da fração. */
export function geoOptionsFromBenchmarks(
  benchmarks: MarketBenchmark[],
): Array<{ code: string; label: string; level: "freguesia" | "concelho" }> {
  const seen = new Map<string, { code: string; label: string; level: "freguesia" | "concelho" }>();
  for (const b of benchmarks) {
    if (seen.has(b.dicofre)) continue;
    const label =
      b.level === "freguesia"
        ? `${b.parish_name ?? b.dicofre}${b.municipality ? ` (${b.municipality})` : ""}`
        : (b.municipality ?? b.parish_name ?? b.dicofre);
    seen.set(b.dicofre, { code: b.dicofre, label, level: b.level });
  }
  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, "pt"));
}
