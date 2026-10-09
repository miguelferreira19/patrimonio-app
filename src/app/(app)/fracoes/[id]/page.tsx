import Link from "next/link";
import { notFound } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  ContractFormButton,
  DeleteContractButton,
  DeletePropertyButton,
  EndContractButton,
  ExpenseFormButton,
  PropertyFormButton,
  RentUpdateButton,
} from "@/components/forms";
import { Badge, buttonClass, cn } from "@/components/ui";
import { Carregar } from "@/components/documentos/carregar";
import { Money } from "@/components/kit";
import { monthCellStatus, type MonthCellData } from "@/lib/monthcell";
import { geoOptionsFromBenchmarks, marketView, rentUpdateEligibility, sum, vacancyGaps } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { addMonthsKey, fmtDate, fmtEur, fmtNum, fmtPct, lastMonthsKeys, monthLabel, nomeProprio, todayISO } from "@/lib/format";
import { classifyUso } from "@/lib/irs";
import { horizonteDaFonte, lastDueMonthKey, referenceRent, toMonthKey } from "@/lib/arrears";
import { chaveDoInquilino } from "@/lib/portfolio/inquilinos";
import { chaveDoPredio, normalizarMorada, rotuloDaFracao } from "@/lib/portfolio/predios";
import { ListaDocumentos, lerArquivo } from "@/components/documentos/lista";
import { escopoSeguro } from "@/lib/documentos";
import { codigosDeTerritorioEmUso, fetchGeoOptions } from "@/lib/portfolio/load";
import type {
  Contract,
  Expense,
  Landlord,
  MarketBenchmark,
  Payment,
  Property,
  PropertyOwner,
  Receipt,
  RentUpdate,
  UpdateCoefficient,
} from "@/lib/types";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/types";
import { DeviationBadge } from "@/components/kit/badges";
import { linha, linhas } from "@/lib/supabase/dados";

export const dynamic = "force-dynamic";

// ---------- Histórico completo de pagamentos (por ano civil) ----------
// Objetivo (pedido do utilizador): perceber se há mais em atraso para além dos
// últimos 12 meses. Reutiliza a MESMA semântica de "mês em falta" da metodologia
// de Atrasos (src/lib/arrears.ts: EPSILON_EUR, lastDueMonthKey com carência de
// GRACE_DAYS dias) em vez de duplicar a regra com números diferentes.

// A célula é a mesma de Atrasos e de Pagamentos (lib/monthcell.ts + faixa/celula.tsx).
// A V1 tinha aqui uma terceira implementação, com o seu próprio mapa de cores e as suas
// próprias regras — era assim que o mesmo mês aparecia com estados diferentes em páginas
// diferentes (bugs B2/L3 do PLANO.md).
interface HistYearBlock {
  year: number;
  months: MonthCellData[]; // 12 células, Jan..Dez
  totalReceived: number;
  monthsMissing: number;
}

interface ContractHistory {
  contract: Contract;
  years: HistYearBlock[];
}

function yearMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);
}

/** Histórico ano-a-ano de UM contrato, do ano de início (ou do 1º pagamento, na falta de
 *  start_date) até ao ano corrente. "Fora do período" cobre tanto meses antes do início /
 *  depois do fim do contrato como meses ainda não vencidos (isDue = m <= lastDue). */
function buildContractHistory(
  contract: Contract,
  contractPayments: Payment[],
  lastDue: string,
  currentYear: number,
): ContractHistory {
  const monthSums = new Map<string, number>();
  for (const p of contractPayments) {
    const k = toMonthKey(p.ref_month);
    monthSums.set(k, (monthSums.get(k) ?? 0) + p.amount);
  }

  // MESMA base de comparação da página de Atrasos (renda de referência calibrada aos
  // pagamentos, não `contract.rent`) — senão as duas vistas contradiziam-se no mesmo mês.
  const expected = referenceRent(monthSums, contract.rent, lastDue);

  const startMonthKey = contract.start_date ? toMonthKey(contract.start_date) : null;
  const endMonthKey = contract.end_date ? toMonthKey(contract.end_date) : null;
  const startYear = startMonthKey
    ? parseInt(startMonthKey.slice(0, 4), 10)
    : contractPayments.length > 0
      ? Math.min(...contractPayments.map((p) => parseInt(p.ref_month.slice(0, 4), 10)))
      : currentYear;

  const years: HistYearBlock[] = [];
  for (let y = startYear; y <= currentYear; y++) {
    const months = yearMonthKeys(y).map((m): MonthCellData => {
      const paid = monthSums.get(m) ?? 0;
      const withinContract = (!startMonthKey || m >= startMonthKey) && (!endMonthKey || m <= endMonthKey);
      // Mesma prioridade de computeArrearsRow: fora do período do contrato vence sempre.
      // Nota: meses dentro do contrato mas depois de `lastDue` passam a `futuro` (hachura
      // ardósia) em vez de `fora` (cinzento) — antes pareciam "fora do contrato", quando
      // na verdade são meses que a app ainda não conhece.
      const status = monthCellStatus({
        month: m,
        paid,
        expected,
        activeInMonth: withinContract,
        horizon: lastDue,
      });
      return { month: m, status, paid, expected };
    });
    const totalReceived = sum(months.map((m) => m.paid));
    const monthsMissing = months.filter((m) => m.status === "falta").length;
    years.push({ year: y, months, totalReceived, monthsMissing });
  }
  return { contract, years };
}

export default async function FracaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const separador = (await searchParams).tab ?? "resumo";
  const { supabase, isAdmin } = await getSession();

  const [propQ, ownersQ, landlordsQ, contractsQ, geo] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase.from("property_owners").select("*").eq("property_id", id),
    supabase.from("landlords").select("*").order("name"),
    supabase.from("contracts").select("*").eq("property_id", id).order("start_date", { ascending: false }),
    // A lista TODA de territórios só serve o formulário de edição, e só o admin o vê.
    isAdmin ? fetchGeoOptions(supabase) : Promise.resolve([]),
  ]);

  const property = linha<Property>(propQ, "properties");
  if (!property) notFound();

  const owners = linhas<PropertyOwner>(ownersQ, "property_owners");
  const landlords = linhas<Landlord>(landlordsQ, "landlords");
  const contracts = linhas<Contract>(contractsQ, "contracts");
  const geoOptions = geoOptionsFromBenchmarks(geo);

  // Horizonte de dados da CARTEIRA (não só desta fração): último mês devido não pode passar
  // o último mês importado, senão a grelha marca meses ainda-não-importados como "em falta".
  // Mesmo critério da página de Atrasos (dataHorizonMonth). Query barata: 1 linha.
  const horizonCap = lastDueMonthKey(new Date());

  const contractIds = contracts.map((c) => c.id);
  // Só os territórios DESTA fração (a freguesia e os prefixos do concelho), como no
  // snapshot. Era um `select("*")` à tabela inteira: o país todo, e cortado às 1000 linhas
  // pelo PostgREST assim que o INE publicar o próximo trimestre.
  const codigos = codigosDeTerritorioEmUso([property]);
  const [paymentsQ, receiptsQ, expensesQ, updatesQ, horizonQ, coefficientsQ, arquivo, benchQ] = await Promise.all([
    // Histórico COMPLETO (sem piso temporal) — a secção "Histórico de pagamentos" precisa
    // de todos os anos, não só dos últimos 12 meses.
    // ATENÇÃO ao que este .limit() NÃO faz: não passa por cima do max-rows (~1000) do
    // PostgREST — nada passa, é por isso que existe o paginateAll. Aqui é seguro por outra
    // razão, e só por ela: são os pagamentos de UMA fração, ou seja um punhado de contratos
    // × 12 meses/ano. Chegar a 1000 linhas exigia ~80 anos de contrato. Se um dia esta
    // query passar a abranger mais do que uma fração, tem de ser paginada.
    contractIds.length > 0
      ? supabase.from("payments").select("*").in("contract_id", contractIds).limit(20000)
      : Promise.resolve({ data: [] as Payment[] }),
    supabase
      .from("receipts")
      .select("*")
      .eq("property_id", id)
      .order("ref_month", { ascending: false })
      .limit(24),
    supabase
      .from("expenses")
      .select("*")
      .eq("property_id", id)
      .order("expense_date", { ascending: false })
      .limit(50),
    contractIds.length > 0
      ? supabase
          .from("rent_updates")
          .select("*")
          .in("contract_id", contractIds)
          .order("effective_date", { ascending: false })
      : Promise.resolve({ data: [] as RentUpdate[] }),
    supabase
      .from("payments")
      .select("ref_month")
      .lte("ref_month", horizonCap)
      .order("ref_month", { ascending: false })
      .limit(1),
    supabase.from("update_coefficients").select("*"),
    // O arquivo inteiro numa chamada (os caminhos são planos, ver lib/documentos.ts) e
    // filtra-se em memória. Enquanto o bucket não existir devolve vazio sem rebentar.
    lerArquivo(supabase),
    codigos.length > 0
      ? supabase.from("market_benchmarks").select("*").in("dicofre", codigos)
      : Promise.resolve({ data: [] as MarketBenchmark[] }),
  ]);
  const benchmarks = linhas<MarketBenchmark>(benchQ, "market_benchmarks");

  const docsDaFracao = property.matriz_article
    ? arquivo.docs.filter((d) => d.escopo === escopoSeguro(property.matriz_article))
    : [];

  const payments = linhas<Payment>(paymentsQ, "payments");
  const receipts = linhas<Receipt>(receiptsQ, "receipts");
  const expenses = linhas<Expense>(expensesQ, "expenses");
  const rentUpdates = linhas<RentUpdate>(updatesQ, "rent_updates");
  const coefficients = linhas<UpdateCoefficient>(coefficientsQ, "update_coefficients");
  const portfolioHorizon = linhas<{ ref_month: string }>(horizonQ, "payments (fronteira)")[0]?.ref_month ?? null;

  const active = contracts.find((c) => c.status === "ativo");
  // Quem emite os recibos desta fração: o senhorio do recibo mais recente.
  const fonteDosRecibos =
    receipts
      .filter((r) => r.issue_date)
      .sort((a, b) => (b.issue_date ?? "").localeCompare(a.issue_date ?? ""))[0]?.landlord_id ?? null;
  const rentEligibility = active
    ? rentUpdateEligibility(active, rentUpdates, coefficients, todayISO())
    : null;
  const mv = marketView(property, active, benchmarks);
  const landlordById = new Map(landlords.map((l) => [l.id, l]));
  const gaps = vacancyGaps(contracts, todayISO());

  const months = lastMonthsKeys(12);

  const expenses12 = expenses.filter((e) => e.expense_date >= months[0]);
  const rent12 = active ? active.rent * 12 : 0;
  const netYield =
    mv.estimatedValue && active ? (rent12 - sum(expenses12.map((e) => e.amount))) / mv.estimatedValue : null;

  // ---------- Histórico completo de pagamentos (Tarefa: "existe mais em atraso além dos
  // últimos 12 meses?"). Um bloco por contrato (fica "unificado" quando só há um). ----------
  const today = new Date();
  // Limitado ao horizonte de dados da carteira (ver query acima) — igual a Atrasos.
  const lastDueCarteira = portfolioHorizon ? toMonthKey(portfolioHorizon) : lastDueMonthKey(today);
  // ...parado na fonte desta fração (2026-10-03): a fronteira de quem lhe emite os recibos,
  // a mesma regra do snapshot (`horizontePorContrato`). Sem isto, a ficha de uma casa do avô
  // mostrava agosto e setembro "em falta" enquanto a Carteira os mostrava por importar.
  const fonteQ = fonteDosRecibos
    ? await supabase
        .from("receipts")
        .select("issue_date")
        .eq("landlord_id", fonteDosRecibos)
        .not("issue_date", "is", null)
        .order("issue_date", { ascending: false })
        .limit(1)
    : { data: null };
  const ultimaEmissao = linhas<{ issue_date: string }>(fonteQ, "receipts (fonte)")[0]?.issue_date;
  const horizonteFonte = ultimaEmissao ? horizonteDaFonte(ultimaEmissao, today) : null;
  const lastDue =
    horizonteFonte && horizonteFonte < lastDueCarteira ? horizonteFonte : lastDueCarteira;
  const currentYear = today.getFullYear();
  const paymentsByContract = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = paymentsByContract.get(p.contract_id);
    if (list) list.push(p);
    else paymentsByContract.set(p.contract_id, [p]);
  }
  // Mais recente primeiro (contracts já vem ordenado por start_date desc da query).
  // SÓ CONTRATOS ATIVOS: o histórico de um contrato cessado não muda nenhuma decisão — o
  // inquilino foi-se embora e a dívida dele não se cobra nesta página. Continua tudo na
  // base e na página do arrendatário; aqui só ocupava o ecrã. Os cessados aparecem na
  // secção "Histórico de contratos e atualizações de renda", logo abaixo.
  const contratosAtivos = contracts.filter((c) => c.status === "ativo");
  const histories: ContractHistory[] = contratosAtivos.map((c) =>
    buildContractHistory(c, paymentsByContract.get(c.id) ?? [], lastDue, currentYear),
  );
  const cessadosOcultos = contracts.length - contratosAtivos.length;

  const window12Start = addMonthsKey(lastDue, -11);
  let missingOutside12 = 0;
  for (const h of histories) {
    for (const yb of h.years) {
      for (const cell of yb.months) {
        if (cell.status === "falta" && cell.month < window12Start) missingOutside12 += 1;
      }
    }
  }
  const referenceRent = active?.rent ?? contracts[0]?.rent ?? null;

  // ---------- V4 (REDESENHO.md §4.3): ficha em separadores ----------
  const { chave } = chaveDoPredio(property.matriz_article, property.id);
  const rotulo = rotuloDaFracao(property);
  const morada = normalizarMorada(property.address);
  const titulares = owners
    .map((o) => `${landlordById.get(o.landlord_id)?.name ?? "?"} ${fmtNum(o.quota, 0)}%`)
    .join(" + ");
  const tab = TABS.some(([k]) => k === separador) ? separador : "resumo";
  const historiaAtiva = histories[0];
  const ultimosAnos = historiaAtiva ? historiaAtiva.years.slice(-2).reverse() : [];
  const emFalta12 = historiaAtiva
    ? historiaAtiva.years.flatMap((y) => y.months).filter((m) => m.status === "falta" && m.month >= window12Start).length
    : 0;
  const sobe =
    active && rentEligibility?.eligible && (rentEligibility.suggestedRent ?? 0) > active.rent
      ? rentEligibility
      : null;

  return (
    <div className="space-y-6">
      <nav aria-label="Localização" className="text-[13px] text-tinta-3">
        <Link href="/imoveis" className="text-tinta-2 hover:text-tinta">
          Imóveis
        </Link>
        {" / "}
        <Link href={`/imoveis/${encodeURIComponent(chave)}`} className="text-tinta-2 hover:text-tinta">
          {morada ?? "Prédio"}
        </Link>
        {" / "}
        {rotulo}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] md:text-[30px]">{rotulo}</h1>
          <p className="mt-1.5 text-sm text-tinta-2">
            {[morada, property.typology, property.area_m2 ? `${fmtNum(property.area_m2, 0)} m²` : null, titulares]
              .filter(Boolean)
              .join(" · ") || "Sem morada"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={property.status === "vago" ? "atencao" : "neutro"}>
            {property.status === "arrendado" ? "Arrendada" : property.status === "vago" ? "Vaga" : property.status}
          </Badge>
          {isAdmin && (
            <>
              <PropertyFormButton landlords={landlords} geoOptions={geoOptions} property={property} owners={owners} small />
              <details className="relative">
                <summary
                  aria-label="Mais ações"
                  className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-regua-forte bg-carta text-tinta-2 hover:bg-vellum"
                >
                  <MoreHorizontal size={16} />
                </summary>
                <div className="absolute right-0 z-30 mt-2 flex w-56 flex-col gap-1 rounded-xl border border-regua bg-elevado p-2 shadow-[0_16px_40px_-12px_rgba(15,21,23,0.28)]">
                  {active && <EndContractButton contractId={active.id} />}
                  <DeletePropertyButton id={property.id} />
                </div>
              </details>
            </>
          )}
        </div>
      </header>

      <nav aria-label="Secções da fração" className="-mx-4 flex gap-1 overflow-x-auto border-b border-regua px-4 md:mx-0 md:px-0">
        {TABS.map(([k, nome]) => (
          <Link
            key={k}
            href={k === "resumo" ? `/fracoes/${property.id}` : `/fracoes/${property.id}?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              tab === k ? "border-tinta text-tinta" : "border-transparent text-tinta-3 hover:text-tinta-2",
            )}
          >
            {nome}
            {k === "documentos" && docsDaFracao.length > 0 && (
              <span className="ml-1 tabular-nums opacity-60">{docsDaFracao.length}</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "resumo" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <Bloco titulo="Pagamentos" acao={historiaAtiva && <Link href={`/fracoes/${property.id}?tab=pagamentos`} className="text-sm font-medium text-acao hover:underline">Histórico completo</Link>}>
              {ultimosAnos.length === 0 ? (
                <p className="text-sm text-tinta-2">{active ? "Ainda sem pagamentos registados." : "Sem contrato ativo."}</p>
              ) : (
                <div className="space-y-4">
                  {ultimosAnos.map((y) => (
                    <LinhaDoTempo key={y.year} ano={y.year} meses={y.months} total={y.totalReceived} />
                  ))}
                </div>
              )}
            </Bloco>
            <Bloco titulo="Contrato">
              {active ? (
                <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm sm:grid-cols-3">
                  <Facto rotulo="Inquilino">
                    <Link href={`/inquilinos/${encodeURIComponent(chaveDoInquilino(active))}`} className="hover:text-acao">
                      {nomeProprio(active.tenant_name)}
                    </Link>
                  </Facto>
                  <Facto rotulo="Renda">
                    <Money value={active.rent} decimals={2} escala="lg" />
                  </Facto>
                  <Facto rotulo="Desde">{fmtDate(active.start_date)}</Facto>
                  <Facto rotulo="Vence">dia {active.due_day}</Facto>
                  {active.pf_contract_no && <Facto rotulo="Contrato no Portal"><span className="font-mono text-xs">{active.pf_contract_no}</span></Facto>}
                  <Facto rotulo="Fim">
                    {active.end_date ? fmtDate(active.end_date) : <span className="text-atencao">Sem data na base</span>}
                  </Facto>
                </dl>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-tinta-2">Fração sem contrato ativo.</p>
                  {isAdmin && <ContractFormButton propertyId={property.id} />}
                </div>
              )}
            </Bloco>
          </div>

          <aside className="space-y-4">
            {sobe && active ? (
              <ProximoPasso titulo="A renda pode subir">
                <p>
                  De <Money value={active.rent} decimals={2} escala="md" /> para{" "}
                  <Money value={sobe.suggestedRent ?? 0} decimals={2} escala="md" /> desde {monthLabel(sobe.eligibleSince!)}. A carta
                  tem de chegar 30 dias antes de a nova renda valer.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={`/api/minuta/renda/${active.id}`} className={buttonClass({ size: "sm" })}>
                    Carta em Word
                  </a>
                  {isAdmin && <RentUpdateButton contract={{ id: active.id, rent: active.rent }} suggestedRent={sobe.suggestedRent ?? undefined} />}
                </div>
              </ProximoPasso>
            ) : active && emFalta12 > 0 ? (
              <ProximoPasso titulo={`${emFalta12} ${emFalta12 === 1 ? "mês" : "meses"} por pagar`}>
                <p>Nos últimos 12 meses. A interpelação é a carta que antecede qualquer passo formal.</p>
                <a href={`/api/minuta/interpelacao/${active.id}`} className={buttonClass({ size: "sm", className: "mt-3" })}>
                  Interpelação em Word
                </a>
              </ProximoPasso>
            ) : null}

            <Bloco titulo="Mercado">
              {mv.benchmark ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Facto rotulo="Renda/m²">{mv.rentPerM2 !== null ? `${fmtNum(mv.rentPerM2, 2)} €` : "n/d"}</Facto>
                  <Facto rotulo={`Mediana INE ${mv.benchmark.period}`}>
                    {mv.benchmarkRentM2 !== null ? `${fmtNum(mv.benchmarkRentM2, 2)} €` : "n/d"}
                  </Facto>
                  <Facto rotulo="Diferença"><DeviationBadge deviation={mv.deviation} /></Facto>
                  <Facto rotulo="Yield bruto">{fmtPct(mv.grossYield, 1)}</Facto>
                  <Facto rotulo="Valor estimado"><Money value={mv.estimatedValue} escala="md" /></Facto>
                  <Facto rotulo="VPT"><Money value={property.vpt} escala="md" /></Facto>
                </dl>
              ) : (
                <p className="text-sm text-tinta-2">
                  {!property.dicofre
                    ? "Sem freguesia na ficha: não há mediana do INE para comparar."
                    : classifyUso(property.typology) !== "habitacao"
                      ? "Sem comparação: as medianas do INE são de habitação."
                      : !property.area_m2
                        ? "Sem área na ficha, por isso não há €/m²."
                        : "Sem medianas do INE para este concelho."}
                </p>
              )}
            </Bloco>

            <Bloco
              titulo="Documentos"
              acao={<Link href={`/fracoes/${property.id}?tab=documentos`} className="text-sm font-medium text-acao hover:underline">Todos</Link>}
            >
              {docsDaFracao.length === 0 ? (
                <p className="text-sm text-tinta-2">Nada arquivado.</p>
              ) : (
                <ListaDocumentos docs={docsDaFracao.slice(0, 3)} isAdmin={false} />
              )}
            </Bloco>
          </aside>
        </div>
      )}

      {tab === "pagamentos" && (
        <div className="space-y-5">
          <p className={cn("rounded-xl px-4 py-3 text-sm", missingOutside12 > 0 ? "bg-atencao-tenue text-atencao" : "bg-vellum text-tinta-2")}>
            {missingOutside12 > 0
              ? `${missingOutside12} ${missingOutside12 === 1 ? "mês em falta" : "meses em falta"} antes dos últimos 12 meses${referenceRent !== null ? ` (cerca de ${fmtEur(missingOutside12 * referenceRent)} à renda atual)` : ""}.`
              : "Nenhum mês em falta antes dos últimos 12 meses."}
            {cessadosOcultos > 0 && ` ${cessadosOcultos} ${cessadosOcultos === 1 ? "contrato terminado fica" : "contratos terminados ficam"} de fora; o histórico deles está na ficha do inquilino.`}
          </p>
          {histories.length === 0 ? (
            <p className="text-sm text-tinta-2">Sem contrato ativo.</p>
          ) : (
            histories.map((h) => (
              <Bloco key={h.contract.id} titulo={histories.length > 1 ? `${nomeProprio(h.contract.tenant_name)} · desde ${fmtDate(h.contract.start_date)}` : "Ano a ano"}>
                <div className="space-y-4">
                  {h.years.slice().reverse().map((y) => (
                    <LinhaDoTempo key={y.year} ano={y.year} meses={y.months} total={y.totalReceived} />
                  ))}
                </div>
              </Bloco>
            ))
          )}
          <Bloco titulo="Recibos do Portal">
            {receipts.length === 0 ? (
              <p className="text-sm text-tinta-2">Sem recibos importados.</p>
            ) : (
              <ul className="divide-y divide-regua">
                {receipts.slice(0, 24).map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                    <span className="font-mono text-xs text-tinta">{monthLabel(r.ref_month)}</span>
                    <span className="hidden font-mono text-xs text-tinta-3 sm:inline">{r.receipt_number ?? ""}</span>
                    <span className="text-xs text-tinta-3">{fmtDate(r.issue_date)}</span>
                    <Money value={r.amount} decimals={2} escala="md" />
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
        </div>
      )}

      {tab === "contrato" && (
        <div className="space-y-5">
          {active && isAdmin && (
            <div className="flex flex-wrap gap-2">
              <ContractFormButton propertyId={property.id} contract={active} label="Editar contrato" />
              <RentUpdateButton contract={{ id: active.id, rent: active.rent }} suggestedRent={sobe?.suggestedRent ?? undefined} />
              <Link href={`/arquivo?fracao=${property.id}`} className={buttonClass({ variant: "outline", size: "sm" })}>
                Cartas e minutas
              </Link>
            </div>
          )}
          <Bloco titulo="Contratos desta fração">
            {contracts.length === 0 ? (
              <p className="text-sm text-tinta-2">Sem contratos.</p>
            ) : (
              <ul className="divide-y divide-regua">
                {contracts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/inquilinos/${encodeURIComponent(chaveDoInquilino(c))}`} className="font-medium text-tinta hover:text-acao">
                        {nomeProprio(c.tenant_name)}
                      </Link>
                      <p className="text-xs text-tinta-3">
                        {fmtDate(c.start_date)} a {c.end_date ? fmtDate(c.end_date) : "hoje"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Money value={c.rent} decimals={2} escala="md" />
                      <Badge tone="neutro">{c.status === "ativo" ? "Ativo" : "Terminado"}</Badge>
                      {isAdmin && <ContractFormButton propertyId={property.id} contract={c} label="Editar" />}
                      {isAdmin && <DeleteContractButton id={c.id} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
          {rentUpdates.length > 0 && (
            <Bloco titulo="Atualizações de renda">
              <ul className="space-y-1.5 text-sm text-tinta-2">
                {rentUpdates.map((u) => (
                  <li key={u.id} className="tabular-nums">
                    {fmtDate(u.effective_date)}: {fmtEur(u.old_rent, 2)} para {fmtEur(u.new_rent, 2)}{" "}
                    <span className="text-xs text-tinta-3">({u.reason})</span>
                  </li>
                ))}
              </ul>
            </Bloco>
          )}
          {gaps.length > 0 && (
            <Bloco titulo="Períodos sem inquilino">
              <ul className="space-y-1.5 text-sm text-tinta-2">
                {gaps.map((g) => (
                  <li key={g.gapStart} className="tabular-nums">
                    {fmtDate(g.gapStart)} a {g.gapEnd ? fmtDate(g.gapEnd) : "hoje"}{" "}
                    <span className="text-xs text-tinta-3">({g.days} dias, cerca de {fmtEur(g.lostRent)} perdidos)</span>
                  </li>
                ))}
              </ul>
            </Bloco>
          )}
        </div>
      )}

      {tab === "documentos" && (
        <Bloco titulo="Documentos desta fração">
          {isAdmin && property.matriz_article && (
            <div className="mb-4">
              <Carregar
                fracoes={[{ matriz: property.matriz_article, label: rotulo }]}
                destino={{ matriz: property.matriz_article, label: rotulo }}
              />
            </div>
          )}
          {docsDaFracao.length === 0 ? (
            <p className="text-sm text-tinta-2">Nada arquivado nesta fração.</p>
          ) : (
            <ListaDocumentos docs={docsDaFracao} isAdmin={isAdmin} />
          )}
        </Bloco>
      )}

      {tab === "despesas" && (
        <Bloco
          titulo="Despesas"
          acao={isAdmin && <ExpenseFormButton properties={[{ id: property.id, name: rotulo }]} defaultPropertyId={property.id} />}
        >
          <p className="mb-3 text-sm text-tinta-2">
            Últimos 12 meses: <Money value={sum(expenses12.map((e) => e.amount))} escala="md" />
            {netYield !== null && ` · yield líquido ${fmtPct(netYield, 1)}`}
          </p>
          {expenses.length === 0 ? (
            <p className="text-sm text-tinta-2">Sem despesas registadas.</p>
          ) : (
            <ul className="divide-y divide-regua">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-tinta">{EXPENSE_CATEGORY_LABEL[e.category]}</p>
                    <p className="truncate text-xs text-tinta-3">
                      {fmtDate(e.expense_date)}
                      {e.description ? ` · ${e.description}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Money value={e.amount} decimals={2} escala="md" />
                    {isAdmin && <ExpenseFormButton properties={[{ id: property.id, name: rotulo }]} expense={e} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      )}
    </div>
  );
}

const TABS: Array<[string, string]> = [
  ["resumo", "Resumo"],
  ["pagamentos", "Pagamentos"],
  ["contrato", "Contrato"],
  ["documentos", "Documentos"],
  ["despesas", "Despesas"],
];

function Bloco({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-regua bg-carta p-5 shadow-[0_1px_2px_rgba(15,21,23,0.04)]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-[-0.01em]">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Facto({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-tinta-3">{rotulo}</dt>
      <dd className="mt-0.5 font-medium text-tinta">{children}</dd>
    </div>
  );
}

function ProximoPasso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-acao-tenue p-5 text-sm text-tinta-2">
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-acao">Próximo passo</p>
      <h2 className="mt-1 text-base font-semibold text-tinta">{titulo}</h2>
      <div className="mt-1.5 leading-relaxed">{children}</div>
    </section>
  );
}

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Um ano em 12 células: a altura é a fração da renda que entrou; o eixo vive FORA das
 *  células (a faixa repetia o nome do mês dentro de cada uma). */
function LinhaDoTempo({ ano, meses, total }: { ano: number; meses: MonthCellData[]; total: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-tinta-2">{ano}</span>
        <Money value={total} escala="sm" tom="tinta-2" />
      </div>
      <div className="grid grid-cols-12 gap-1">
        {meses.map((m) => {
          const fr = m.expected > 0 ? Math.min(1, m.paid / m.expected) : 0;
          return (
            <div
              key={m.month}
              title={`${monthLabel(m.month)}: ${fmtEur(m.paid)}`}
              className={cn(
                "relative h-9 overflow-hidden rounded-[4px]",
                m.status === "falta" && "bg-perda-tenue shadow-[inset_0_-3px_0_var(--color-perda)]",
                m.status === "fora" && "bg-vellum",
                m.status === "futuro" && "tecido-futuro",
                (m.status === "pago" || m.status === "parcial") && "bg-vellum",
              )}
            >
              {(m.status === "pago" || m.status === "parcial") && (
                <span
                  className={cn("absolute inset-x-0 bottom-0", m.status === "pago" ? "bg-tinta" : "bg-atencao")}
                  style={{ height: `${Math.max(12, fr * 100)}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-12 gap-1 text-center text-[10px] text-tinta-3">
        {MES_CURTO.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}
