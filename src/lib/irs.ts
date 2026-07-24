// Apoio ao IRS por senhorio (PLANO.md P2-2, P2-6, P2-7, P3-5). Módulo PURO: sem Supabase,
// sem React. A página `(app)/irs` e a rota `/api/irs` (export do Anexo F) importam daqui os
// MESMOS cálculos, para o ecrã e o Excel nunca divergirem.
//
// AVISO EM TODO O MÓDULO: são ESTIMATIVAS para apoio à decisão — não é aconselhamento fiscal
// vinculativo. Confirmar sempre no simulador da AT ou com contabilista (ver PLANO.md §9).

import type { Contract, Expense, ExpenseCategory, Property, PropertyOwner, Receipt } from "./types";

// ---------------------------------------------------------------------------
// Escalões de IRS (englobamento) — única tabela deste ficheiro que precisa de
// manutenção anual. Marcada claramente para ser fácil de atualizar.
// ---------------------------------------------------------------------------

export interface IrsBracket {
  /** Limite superior do escalão em EUR (exclusive); null = último escalão, sem limite. */
  upTo: number | null;
  /** Taxa marginal aplicada só à fatia de rendimento dentro deste escalão. */
  rate: number;
}

/**
 * Escalões gerais do art.º 68.º do CIRS (Continente, rendimento coletável), POR ANO FISCAL:
 * o IRS de 2025 calcula-se com os escalões de 2025, não com os do ano em que se declara.
 * ESTIMATIVA — não confirmada campo a campo contra a tabela oficial da AT. Ano novo = mais
 * uma entrada aqui; a UI mostra sempre o ano da tabela que usou.
 */
export const IRS_BRACKETS_BY_YEAR: Record<number, IrsBracket[]> = {
  2025: [
    { upTo: 8_059, rate: 0.125 },
    { upTo: 12_160, rate: 0.16 },
    { upTo: 17_233, rate: 0.215 },
    { upTo: 22_306, rate: 0.244 },
    { upTo: 28_400, rate: 0.314 },
    { upTo: 41_629, rate: 0.349 },
    { upTo: 44_987, rate: 0.431 },
    { upTo: 83_696, rate: 0.446 },
    { upTo: null, rate: 0.48 },
  ],
  // 2026 (Lei n.º 73-A/2025, OE2026): limites de 2025 atualizados em 3,51% e taxas
  // do 2.º ao 5.º escalão reduzidas em 0,3 p.p.
  2026: [
    { upTo: 8_342, rate: 0.125 },
    { upTo: 12_587, rate: 0.157 },
    { upTo: 17_838, rate: 0.212 },
    { upTo: 23_089, rate: 0.241 },
    { upTo: 29_397, rate: 0.311 },
    { upTo: 43_090, rate: 0.349 },
    { upTo: 46_566, rate: 0.431 },
    { upTo: 86_634, rate: 0.446 },
    { upTo: null, rate: 0.48 },
  ],
};

/**
 * Escalões aplicáveis a um ano fiscal: os do próprio ano, ou, se ainda não estiverem
 * na tabela, os do ano mais recente que lá esteja. Devolve também o ano usado, para a
 * UI poder dizer ao utilizador quando está a extrapolar (ex.: IRS de 2027 com escalões
 * de 2026, enquanto o Orçamento do Estado seguinte não sair).
 */
export function bracketsForYear(year: number): { brackets: IrsBracket[]; bracketsYear: number } {
  const years = Object.keys(IRS_BRACKETS_BY_YEAR).map(Number).sort((a, b) => a - b);
  const match = years.filter((y) => y <= year).pop() ?? years[0]!;
  return { brackets: IRS_BRACKETS_BY_YEAR[match]!, bracketsYear: match };
}

/** Taxa autónoma/liberatória da Categoria F (art.º 72.º, n.º 1, do CIRS). */
export const AUTONOMOUS_RATE = 0.28;

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Imposto por escalões marginais puros (soma de cada fatia à taxa do respetivo escalão).
 * Simplificação assumida (documentar sempre ao mostrar o resultado): SEM quociente conjugal
 * e SEM outras categorias de rendimento — trata o predial líquido deste senhorio como se
 * fosse a única base tributável. Na vida real ele soma-se a pensões/salários e pode cair em
 * escalões mais altos. Serve para comparar a ORDEM DE GRANDEZA com os 28% autónomos, não para
 * prever o imposto final da família.
 */
export function progressiveTax(taxableIncome: number, brackets: IrsBracket[]): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    const upper = b.upTo ?? Infinity;
    if (taxableIncome <= lower) break;
    tax += (Math.min(taxableIncome, upper) - lower) * b.rate;
    lower = upper;
  }
  return round2(tax);
}

// ---------------------------------------------------------------------------
// P2-5/P2-6 — dedutibilidade de despesas no Anexo F (art.º 41.º do CIRS)
// ---------------------------------------------------------------------------

export type ExpenseDeductibility = "dedutivel" | "a_confirmar" | "excluida";

/**
 * Mapeamento despesas -> dedutibilidade no Anexo F, a partir das categorias existentes em
 * `expenses` (src/lib/types.ts — não há categorias próprias para "conservação/manutenção",
 * "selo" ou "taxas autárquicas"). Decisão de mapeamento:
 *  - imi / condominio: dedutíveis diretos, com coluna própria no Anexo F.
 *  - obras: AMBÍGUA — pode ser conservação/manutenção (dedutível) ou obra de valorização
 *    (excluída pelo art.º 41.º); a app não distingue as duas -> NÃO deduz, fica "a confirmar".
 *  - outras: categoria residual, dedutibilidade desconhecida -> "a confirmar".
 *  - seguro: prémio de seguro não é uma das rubricas dedutíveis do Anexo F -> excluída.
 *  - financiamento: juros/amortização de crédito -> excluída (regra explícita do art.º 41.º).
 */
export const EXPENSE_DEDUCTIBILITY: Record<ExpenseCategory, ExpenseDeductibility> = {
  imi: "dedutivel",
  condominio: "dedutivel",
  obras: "a_confirmar",
  outras: "a_confirmar",
  seguro: "excluida",
  financiamento: "excluida",
};

// ---------------------------------------------------------------------------
// Agregação por fração e ano — ano fiscal = ano de RECEBIMENTO (issue_date)
// ---------------------------------------------------------------------------

export type IrsReceiptInput = Pick<Receipt, "property_id" | "amount" | "withholding" | "issue_date">;
export type IrsExpenseInput = Pick<Expense, "property_id" | "category" | "amount" | "expense_date">;

function yearOf(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const y = parseInt(dateISO.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

export interface PropertyReceiptTotals {
  /** amount + withholding, por inteiro (fração) — a quota do senhorio aplica-se depois. */
  grossRent: number;
  withholding: number;
}

/**
 * Agrega os recibos por fração para UM ano fiscal, usando `issue_date` (data do recibo/
 * recebimento) — NÃO `ref_month` (o mês a que a renda diz respeito). Um recibo multi-mês
 * emitido em janeiro por rendas de meses do ano anterior conta TODO no ano de emissão; é a
 * armadilha do Anexo F assinalada no PLANO.md (P2-2/P2-6). Os recibos já vêm sem "Anulado"
 * (excluído no import, ver dados/gerar_sql_import.py).
 */
export function receiptTotalsByProperty(
  receipts: IrsReceiptInput[],
  year: number,
): Map<string, PropertyReceiptTotals> {
  const out = new Map<string, PropertyReceiptTotals>();
  for (const r of receipts) {
    if (!r.property_id) continue;
    if (yearOf(r.issue_date) !== year) continue;
    const cur = out.get(r.property_id) ?? { grossRent: 0, withholding: 0 };
    cur.grossRent += r.amount + r.withholding;
    cur.withholding += r.withholding;
    out.set(r.property_id, cur);
  }
  return out;
}

export interface PropertyExpenseTotals {
  imi: number;
  condominio: number;
  /** obras + outras — NÃO entra no líquido predial; fica listado à parte para o utilizador confirmar. */
  toConfirm: number;
  /** imi + condominio — conveniência para quem só quer o total dedutível. */
  deductible: number;
}

/** Agrega as despesas por fração para UM ano fiscal (`expense_date`). Despesas sem `property_id`
 *  (despesas gerais) não são atribuíveis a uma fração do Anexo F — ficam fora desta agregação. */
export function expenseTotalsByProperty(
  expenses: IrsExpenseInput[],
  year: number,
): Map<string, PropertyExpenseTotals> {
  const out = new Map<string, PropertyExpenseTotals>();
  for (const e of expenses) {
    if (!e.property_id) continue;
    if (yearOf(e.expense_date) !== year) continue;
    const cur = out.get(e.property_id) ?? { imi: 0, condominio: 0, toConfirm: 0, deductible: 0 };
    const kind = EXPENSE_DEDUCTIBILITY[e.category];
    if (e.category === "imi") cur.imi += e.amount;
    else if (e.category === "condominio") cur.condominio += e.amount;
    if (kind === "dedutivel") cur.deductible += e.amount;
    else if (kind === "a_confirmar") cur.toConfirm += e.amount;
    out.set(e.property_id, cur);
  }
  return out;
}

// ---------------------------------------------------------------------------
// P2-2/P2-6 — mapa anual por senhorio + simulação de regime
// ---------------------------------------------------------------------------

export interface LandlordFiscalYear {
  landlordId: string;
  year: number;
  grossRent: number;
  withholding: number;
  deductibleExpenses: number;
  toConfirmExpenses: number;
  /** max(0, grossRent - deductibleExpenses) — não modela perdas prediais por fração nem reporte
   *  de perdas entre anos; é uma simplificação assumida da estimativa. */
  netIncome: number;
  autonomousTax: number;
  englobedTax: number;
  /** Ano da tabela de escalões usada (pode ser anterior ao ano fiscal, ver bracketsForYear). */
  bracketsYear: number;
  bestRegime: "autonoma" | "englobamento";
  bestTax: number;
}

/** Mapa anual (P2-2/P2-6): rendas, retenções e despesas dedutíveis de um senhorio num ano
 *  fiscal, mais a simulação 28% autónoma vs englobamento. As quotas de `property_owners` são
 *  aplicadas AQUI — e só aqui — a rendas/despesas; o resto da app é sempre ótica de família. */
export function computeLandlordFiscalYear(
  landlordId: string,
  year: number,
  owners: PropertyOwner[],
  receipts: IrsReceiptInput[],
  expenses: IrsExpenseInput[],
): LandlordFiscalYear {
  const receiptTotals = receiptTotalsByProperty(receipts, year);
  const expenseTotals = expenseTotalsByProperty(expenses, year);

  let grossRent = 0;
  let withholding = 0;
  let deductibleExpenses = 0;
  let toConfirmExpenses = 0;

  for (const o of owners) {
    if (o.landlord_id !== landlordId) continue;
    const quota = (o.quota ?? 100) / 100;
    const rt = receiptTotals.get(o.property_id);
    if (rt) {
      grossRent += rt.grossRent * quota;
      withholding += rt.withholding * quota;
    }
    const et = expenseTotals.get(o.property_id);
    if (et) {
      deductibleExpenses += et.deductible * quota;
      toConfirmExpenses += et.toConfirm * quota;
    }
  }

  grossRent = round2(grossRent);
  withholding = round2(withholding);
  deductibleExpenses = round2(deductibleExpenses);
  toConfirmExpenses = round2(toConfirmExpenses);
  const netIncome = Math.max(0, round2(grossRent - deductibleExpenses));

  const autonomousTax = round2(netIncome * AUTONOMOUS_RATE);
  const { brackets, bracketsYear } = bracketsForYear(year);
  const englobedTax = progressiveTax(netIncome, brackets);
  const bestRegime: "autonoma" | "englobamento" = englobedTax <= autonomousTax ? "englobamento" : "autonoma";
  const bestTax = Math.min(autonomousTax, englobedTax);

  return {
    landlordId,
    year,
    grossRent,
    withholding,
    deductibleExpenses,
    toConfirmExpenses,
    netIncome,
    autonomousTax,
    englobedTax,
    bracketsYear,
    bestRegime,
    bestTax,
  };
}

// ---------------------------------------------------------------------------
// P2-7 — elegibilidade de taxa reduzida (art.º 72.º) por contrato
// ---------------------------------------------------------------------------

export type UsoClassification = "habitacao" | "comercial" | "a_confirmar";

const COMERCIAL_KEYWORDS = [
  "loja", "garagem", "armazem", "armazém", "escritorio", "escritório",
  "comercio", "comércio", "servicos", "serviços", "industria", "indústria",
];

/** Classifica o uso de uma fração a partir de `typology` (P0-2). Vazio -> "a_confirmar"
 *  (nunca se assume habitação sem informação — comércio/garagens não beneficiam do art.º 72.º). */
export function classifyUso(typology: string | null): UsoClassification {
  if (!typology || typology.trim() === "") return "a_confirmar";
  const t = typology.trim().toLowerCase();
  if (/^t\d/.test(t) || t.includes("habita")) return "habitacao";
  if (COMERCIAL_KEYWORDS.some((k) => t.includes(k))) return "comercial";
  return "a_confirmar";
}

/** Anos completos decorridos entre duas datas ISO (chão — não arredonda para cima). */
export function yearsBetween(startISO: string, endISO: string): number {
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  const anniversary = new Date(start);
  anniversary.setUTCFullYear(start.getUTCFullYear() + years);
  if (anniversary.getTime() > end.getTime()) years -= 1;
  return Math.max(0, years);
}

/** Escalões do art.º 72.º do CIRS (contratos de habitação de longa duração), por ordem
 *  decrescente de anos — o primeiro que o contrato atinja é o aplicável. */
export const REDUCED_RATE_BRACKETS: Array<{ minYears: number; rate: number }> = [
  { minYears: 20, rate: 0.05 },
  { minYears: 10, rate: 0.10 },
  { minYears: 5, rate: 0.15 },
];

export interface ReducedRateResult {
  contractId: string;
  propertyId: string;
  uso: UsoClassification;
  durationYears: number | null;
  /** null = não elegível (< 5 anos), uso não habitacional, ou uso "a confirmar". */
  eligibleRate: number | null;
  /** (28% − taxa elegível) × renda anual bruta atual × quota do senhorio. */
  annualSavings: number | null;
}

/** P2-7: elegibilidade de um contrato à taxa reduzida de longa duração. Só contratos de
 *  HABITAÇÃO (uso "a_confirmar" ou "comercial" nunca entram) — é um ALERTA, não altera nada
 *  sozinho; a comunicação à AT segue a Portaria n.º 110/2019. */
export function reducedRateEligibility(
  contract: Pick<Contract, "id" | "property_id" | "start_date" | "rent">,
  typology: string | null,
  quotaPct: number,
  todayISO: string,
): ReducedRateResult {
  const uso = classifyUso(typology);
  if (uso !== "habitacao" || !contract.start_date) {
    return {
      contractId: contract.id,
      propertyId: contract.property_id,
      uso,
      durationYears: null,
      eligibleRate: null,
      annualSavings: null,
    };
  }
  const durationYears = yearsBetween(contract.start_date, todayISO);
  const bracket = REDUCED_RATE_BRACKETS.find((b) => durationYears >= b.minYears);
  const eligibleRate = bracket?.rate ?? null;
  const annualSavings =
    eligibleRate !== null
      ? round2((AUTONOMOUS_RATE - eligibleRate) * contract.rent * 12 * (quotaPct / 100))
      : null;
  return { contractId: contract.id, propertyId: contract.property_id, uso, durationYears, eligibleRate, annualSavings };
}

// ---------------------------------------------------------------------------
// P3-5 — Monitor de AIMI
// ---------------------------------------------------------------------------

export const AIMI_THRESHOLD_SINGLE = 600_000;
export const AIMI_THRESHOLD_COUPLE = 1_200_000;

export interface AimiExposure {
  landlordId: string;
  totalVpt: number;
  overSingle: boolean;
  overCouple: boolean;
}

/**
 * Soma o VPT por quota (`property_owners`), excluindo frações "vendido" (já não são da
 * família — P0-2c) e "terreno" (presume-se prédio rústico, isento de AIMI; se algum terreno
 * for para construção urbana fica de fora por omissão — confirmar caso a caso). Só SINALIZA
 * exposição: nunca recomenda redistribuir propriedade (é planeamento sucessório, remeter para
 * contabilista).
 */
export function aimiExposure(
  landlordId: string,
  owners: PropertyOwner[],
  propertiesById: Map<string, Pick<Property, "id" | "vpt" | "status">>,
): AimiExposure {
  let total = 0;
  for (const o of owners) {
    if (o.landlord_id !== landlordId) continue;
    const p = propertiesById.get(o.property_id);
    if (!p || p.status === "vendido" || p.status === "terreno" || !p.vpt) continue;
    total += p.vpt * ((o.quota ?? 100) / 100);
  }
  total = round2(total);
  return {
    landlordId,
    totalVpt: total,
    overSingle: total > AIMI_THRESHOLD_SINGLE,
    overCouple: total > AIMI_THRESHOLD_COUPLE,
  };
}

// ---------------------------------------------------------------------------
// Anexo F — linhas por contrato (partilhadas pela página e pelo export Excel)
// ---------------------------------------------------------------------------

export interface MatrizParts {
  freguesia: string | null;
  tipo: string | null;
  artigo: string | null;
  fracaoSeccao: string | null;
}

/** Extrai Freguesia/Tipo/Artigo/Fração-Secção de `matriz_article` ("182341-U-2381-K" ->
 *  freguesia 182341, tipo U, artigo 2381, fração K) — mesmo formato usado em
 *  dados/analise_senhorio.py. Formato inesperado -> tudo null (fica em branco no export, não
 *  se inventa identificação matricial). */
export function parseMatriz(matrizArticle: string | null): MatrizParts {
  if (!matrizArticle) return { freguesia: null, tipo: null, artigo: null, fracaoSeccao: null };
  const parts = matrizArticle.split("-");
  return {
    freguesia: parts[0] ?? null,
    tipo: parts[1] ?? null,
    artigo: parts[2] ?? null,
    fracaoSeccao: parts[3] ?? null,
  };
}

export interface AnexoFRow {
  contractId: string;
  propertyId: string;
  pfContractNo: string | null;
  matriz: MatrizParts;
  startDate: string | null;
  quotaPct: number;
  /** Renda ilíquida do ano (issue_date), já × quota do senhorio. */
  grossRent: number;
  withholding: number;
  condominio: number;
  imi: number;
  reduced: ReducedRateResult;
}

/** Linhas do Anexo F (Quadro 4.1/4.2) para um senhorio/ano: uma por contrato com rendas ou
 *  despesas dedutíveis nesse ano. Reutilizada pela página `(app)/irs` e pela rota
 *  `/api/irs` (export .xlsx) — nunca calcular isto duas vezes com números diferentes. */
export function anexoFRows(
  landlordId: string,
  year: number,
  owners: PropertyOwner[],
  contracts: Array<Pick<Contract, "id" | "property_id" | "pf_contract_no" | "start_date" | "rent">>,
  propertiesById: Map<string, Pick<Property, "id" | "matriz_article" | "typology">>,
  receipts: IrsReceiptInput[],
  expenses: IrsExpenseInput[],
  todayISO: string,
): AnexoFRow[] {
  const receiptTotals = receiptTotalsByProperty(receipts, year);
  const expenseTotals = expenseTotalsByProperty(expenses, year);
  const quotaByProperty = new Map<string, number>();
  for (const o of owners) {
    if (o.landlord_id === landlordId) quotaByProperty.set(o.property_id, o.quota ?? 100);
  }

  const rows: AnexoFRow[] = [];
  for (const c of contracts) {
    const quotaPct = quotaByProperty.get(c.property_id);
    if (quotaPct === undefined) continue; // este senhorio não é titular desta fração
    const rt = receiptTotals.get(c.property_id);
    const et = expenseTotals.get(c.property_id);
    if (!rt && !et) continue; // sem rendas nem despesas dedutíveis no ano — não entra no Anexo F
    const q = quotaPct / 100;
    const property = propertiesById.get(c.property_id);
    rows.push({
      contractId: c.id,
      propertyId: c.property_id,
      pfContractNo: c.pf_contract_no,
      matriz: parseMatriz(property?.matriz_article ?? null),
      startDate: c.start_date,
      quotaPct,
      grossRent: round2((rt?.grossRent ?? 0) * q),
      withholding: round2((rt?.withholding ?? 0) * q),
      condominio: round2((et?.condominio ?? 0) * q),
      imi: round2((et?.imi ?? 0) * q),
      reduced: reducedRateEligibility(c, property?.typology ?? null, quotaPct, todayISO),
    });
  }
  return rows;
}
