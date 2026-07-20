// Cálculos de negócio: rendas esperadas, desvios ao mercado, yields.
import type { Contract, Expense, MarketBenchmark, Payment, Property } from "./types";
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
