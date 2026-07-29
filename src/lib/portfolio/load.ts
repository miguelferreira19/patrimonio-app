// Leitura ÚNICA da carteira (PLANO.md §7.1).
//
// O que isto resolve: na V1 são 13 páginas, cada uma com o seu `Promise.all`, todas com
// `force-dynamic` e nenhuma com cache. O dashboard lê os ~5.100 pagamentos inteiros e
// corre `computeArrears`, e a página de Atrasos volta a ler e a calcular exatamente o
// mesmo. Aqui lê-se uma vez por request e constrói-se um snapshot que todas as
// superfícies partilham.
//
// Este ficheiro é a ÚNICA parte da camada de portfólio que faz I/O. Tudo o que é cálculo
// vive em `snapshot.ts`, que é puro e testável sem BD.

import { createClient } from "../supabase/server";
import { paginateAll, paginateAllParallel } from "../paginate";
import type { GeoBenchmark } from "../calc";
import type {
  Contract,
  Expense,
  InsightState,
  Landlord,
  MarketBenchmark,
  Payment,
  Property,
  PropertyOwner,
  Receipt,
  RentUpdate,
  UpdateCoefficient,
} from "../types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** As colunas que o histórico precisa: `contract_id`, `ref_month` e `amount` para
 *  `computeArrears`, a renda de referência e a fronteira de dados (`ArrearsPaymentInput`);
 *  `received_date` para a CURVA DE CURA (risk.ts), que mede `received_date − ref_month`.
 *  Ler as 10 colunas de 5.100 linhas para usar 4 era ~1 MB de JSON por página. */
export type PaymentLight = Pick<
  Payment,
  "contract_id" | "ref_month" | "amount" | "received_date"
>;

export interface RawData {
  properties: Property[];
  contracts: Contract[];
  owners: PropertyOwner[];
  landlords: Landlord[];
  benchmarks: MarketBenchmark[];
  /** Histórico COMPLETO e paginado, em colunas mínimas. Vazio quando `comHistorico:
   *  false` — ver `historicoCarregado` no Snapshot. Nunca pode vir truncado: a armadilha
   *  das 1000 linhas está em CLAUDE.md. */
  payments: PaymentLight[];
  /** Linhas COMPLETAS dos últimos meses: a grelha de Pagamentos precisa de data, método
   *  e id para o modal. São ~12 meses de contratos ativos, muito abaixo das 1000. */
  paymentsRecentes: Payment[];
  expenses: Expense[];
  rentUpdates: RentUpdate[];
  coefficients: UpdateCoefficient[];
  /** Só o mês corrente, e só as duas colunas que provam emissão: é o que a checklist de
   *  "recibos por emitir" precisa. Um mês tem tantas linhas como contratos ativos. */
  receiptsThisMonth: Array<Pick<Receipt, "contract_id" | "pf_contract_no">>;
  /** Recibos dos últimos 12 meses, em colunas mínimas. `amount` é ILÍQUIDO, e é por isso
   *  que serve para conferir `contracts.rent` (também ilíquido) — ao contrário de
   *  `payments.amount`, que é líquido de retenção. ~42 contratos × 12 meses. */
  receiptsRecentes: Array<Pick<Receipt, "contract_id" | "ref_month" | "amount">>;
  /** Contagem, nunca as linhas: são >5000 e só interessa saber quantos estão órfãos. */
  orphanReceipts: number;
  /** Decisões adiadas ou dispensadas (S3). Uma linha por (kind, subject); a tabela tem
   *  tantas linhas quantas as decisões que o utilizador tocou, ou seja, poucas. */
  insightState: InsightState[];
  historicoCarregado: boolean;
}

/** Histórico completo de pagamentos, em paralelo.
 *
 *  Conta primeiro (`head: true`, não traz linhas) para poder pedir as páginas todas de
 *  uma vez: são 6 idas ao Supabase e, em série, eram 6 latências somadas em CADA página.
 *  Se a contagem falhar, cai na versão sequencial — mais lenta, mas nunca perde linhas. */
async function fetchHistorico(supabase: SupabaseClient): Promise<PaymentLight[]> {
  const pagina = async (from: number, to: number) => {
    const { data, error } = await supabase
      .from("payments")
      .select("contract_id,ref_month,amount,received_date")
      // A ordem é obrigatória para as páginas não saltarem nem repetirem linhas.
      .order("contract_id", { ascending: true })
      .order("ref_month", { ascending: true })
      .range(from, to);
    if (error) throw error;
    return (data ?? []) as PaymentLight[];
  };

  const { count, error } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true });
  if (error || count === null) return paginateAll<PaymentLight>(pagina);
  return paginateAllParallel<PaymentLight>(count, pagina);
}

async function fetchAllExpenses(supabase: SupabaseClient): Promise<Expense[]> {
  return paginateAll<Expense>(async (from, to) => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    return (data ?? []) as Expense[];
  });
}

/** Códigos de território que PODEM servir as frações desta carteira: cada dicofre e todos
 *  os seus prefixos.
 *
 *  Porque isto existe: `market_benchmarks` tem o país inteiro (308 concelhos + ~3.000
 *  freguesias × 2 indicadores × períodos). Um `select("*")` traz milhares de linhas em cada
 *  página — e pior, o PostgREST corta a ~1000 em silêncio, o que podia deixar de fora
 *  justamente a freguesia certa. Filtrar pelos códigos em uso resolve as duas coisas.
 *
 *  Os prefixos são precisos porque `benchmarkForMetric` (calc.ts) casa a freguesia pelo
 *  dicofre exato e o concelho por PREFIXO do dicofre da fração. Gerar todos os prefixos
 *  ≥4 caracteres cobre isso sem depender de assumir o comprimento do código (os do INE têm
 *  7 ou 9, o schema documenta 6 — ver bug B5 no PLANO.md). */
function codigosDeTerritorioEmUso(properties: Property[]): string[] {
  const out = new Set<string>();
  for (const p of properties) {
    const d = p.dicofre?.trim();
    if (!d) continue;
    for (let n = 4; n <= d.length; n++) out.add(d.slice(0, n));
  }
  return Array.from(out);
}

/** Todas as leituras da carteira, de uma vez.
 *
 *  `comHistorico: false` salta o histórico de pagamentos (a leitura mais cara, de longe).
 *  Existe porque as Frações e o Mercado não usam pagamentos para NADA — mostram inquilino,
 *  renda, €/m² e desvio ao mercado — e estavam a pagar 5.100 linhas por página sem
 *  precisar. Um snapshot sem histórico tem `arrears`, `faixa` e `fluxo` vazios; quem os lê
 *  tem de usar o snapshot completo.
 *
 *  `thisMonth` é passado (e não calculado aqui) para o chamador poder fixar o relógio. */
export async function loadRaw(
  supabase: SupabaseClient,
  thisMonth: string,
  { comHistorico = true }: { comHistorico?: boolean } = {},
): Promise<RawData> {
  const [
    propertiesQ,
    contractsQ,
    ownersQ,
    landlordsQ,
    payments,
    paymentsRecentesQ,
    expenses,
    rentUpdatesQ,
    coefficientsQ,
    receiptsMonthQ,
    orphanQ,
    receiptsRecentesQ,
    insightStateQ,
  ] = await Promise.all([
    supabase.from("properties").select("*"),
    supabase.from("contracts").select("*"),
    supabase.from("property_owners").select("*"),
    supabase.from("landlords").select("*").order("name"),
    comHistorico ? fetchHistorico(supabase) : Promise.resolve([] as PaymentLight[]),
    // PAGINADO: 12 meses de pagamentos de ~50 contratos cabem hoje nas ~1000 linhas que o
    // PostgREST devolve, mas "cabe hoje" nao e uma garantia — passar do corte perde linhas
    // em SILENCIO, e um pagamento que desaparece vira um mes em falta na faixa.
    comHistorico
      ? paginateAll<Payment>(async (from, to) => {
          const { data, error } = await supabase
            .from("payments")
            .select("*")
            .gte("ref_month", recuar12Meses(thisMonth))
            .order("id", { ascending: true })
            .range(from, to);
          if (error) throw error;
          return (data ?? []) as Payment[];
        })
      : Promise.resolve([] as Payment[]),
    fetchAllExpenses(supabase),
    supabase.from("rent_updates").select("*"),
    supabase.from("update_coefficients").select("*"),
    supabase.from("receipts").select("contract_id,pf_contract_no").eq("ref_month", thisMonth),
    supabase.from("receipts").select("id", { count: "exact", head: true }).is("contract_id", null),
    // PAGINADO pela mesma razao: o .limit(5000) NAO passa por cima do max-rows do servidor.
    paginateAll<{ contract_id: string | null; ref_month: string; amount: number }>(
      async (from, to) => {
        const { data, error } = await supabase
          .from("receipts")
          .select("contract_id,ref_month,amount")
          .gte("ref_month", recuar12Meses(thisMonth))
          .order("id", { ascending: true })
          .range(from, to);
        if (error) throw error;
        return data ?? [];
      },
    ),
    supabase.from("insight_state").select("*"),
  ]);

  const properties = (propertiesQ.data ?? []) as Property[];

  // Segunda vaga: os benchmarks dependem dos dicofres das frações. Custa uma latência a
  // mais e poupa milhares de linhas. Sem nenhuma fração com dicofre, nem se pergunta.
  const codigos = codigosDeTerritorioEmUso(properties);
  const benchmarksQ =
    codigos.length > 0
      ? await supabase.from("market_benchmarks").select("*").in("dicofre", codigos)
      : { data: [] };

  return {
    properties,
    contracts: (contractsQ.data ?? []) as Contract[],
    owners: (ownersQ.data ?? []) as PropertyOwner[],
    landlords: (landlordsQ.data ?? []) as Landlord[],
    benchmarks: (benchmarksQ.data ?? []) as MarketBenchmark[],
    payments,
    paymentsRecentes: paymentsRecentesQ,
    expenses,
    rentUpdates: (rentUpdatesQ.data ?? []) as RentUpdate[],
    coefficients: (coefficientsQ.data ?? []) as UpdateCoefficient[],
    receiptsThisMonth: (receiptsMonthQ.data ?? []) as Array<
      Pick<Receipt, "contract_id" | "pf_contract_no">
    >,
    receiptsRecentes: receiptsRecentesQ as Array<
      Pick<Receipt, "contract_id" | "ref_month" | "amount">
    >,
    orphanReceipts: orphanQ.count ?? 0,
    insightState: (insightStateQ.data ?? []) as InsightState[],
    historicoCarregado: comHistorico,
  };
}

function recuar12Meses(monthKey: string): string {
  const y = parseInt(monthKey.slice(0, 4), 10);
  const m = parseInt(monthKey.slice(5, 7), 10);
  const total = y * 12 + (m - 1) - 11;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** Territórios do INE disponíveis, para o Select de "Território INE" do formulário de
 *  fração. Vive à parte do `loadRaw` de propósito: o snapshot só quer os benchmarks das
 *  frações que JÁ têm dicofre, mas o formulário precisa da lista toda — é lá que se escolhe
 *  o território de uma fração que ainda não tem nenhum. Só 4 colunas, e só para admin. */
export async function fetchGeoOptions(supabase: SupabaseClient): Promise<GeoBenchmark[]> {
  const { data } = await supabase
    .from("market_benchmarks")
    .select("dicofre,parish_name,municipality,level");
  return (data ?? []) as GeoBenchmark[];
}
