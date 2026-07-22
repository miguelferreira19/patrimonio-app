import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Home,
  ReceiptText,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import {
  ContractFormButton,
  DeleteContractButton,
  DeletePropertyButton,
  EndContractButton,
  ExpenseFormButton,
  PropertyFormButton,
  RentUpdateButton,
} from "@/components/forms";
import { Badge, Card, cn, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { geoOptionsFromBenchmarks, marketView, sum } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { addMonthsKey, fmtDate, fmtEur, fmtNum, fmtPct, lastMonthsKeys, monthLabel } from "@/lib/format";
import { EPSILON_EUR, isMonthSettled, lastDueMonthKey, referenceRent, toMonthKey } from "@/lib/arrears";
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
} from "@/lib/types";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/types";
import { DeviationBadge } from "../properties-table";

export const dynamic = "force-dynamic";

// ---------- Histórico completo de pagamentos (por ano civil) ----------
// Objetivo (pedido do utilizador): perceber se há mais em atraso para além dos
// últimos 12 meses. Reutiliza a MESMA semântica de "mês em falta" da metodologia
// de Atrasos (src/lib/arrears.ts: EPSILON_EUR, lastDueMonthKey com carência de
// GRACE_DAYS dias) em vez de duplicar a regra com números diferentes.

type HistMonthStatus = "pago" | "parcial" | "falta" | "fora";

interface HistMonthCell {
  month: string; // "YYYY-MM-01"
  status: HistMonthStatus;
  paid: number;
}

interface HistYearBlock {
  year: number;
  months: HistMonthCell[]; // 12 células, Jan..Dez
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
    const months = yearMonthKeys(y).map((m): HistMonthCell => {
      const paid = monthSums.get(m) ?? 0;
      const withinContract = (!startMonthKey || m >= startMonthKey) && (!endMonthKey || m <= endMonthKey);
      let status: HistMonthStatus;
      // Mesma prioridade de computeArrearsRow (arrears.ts): fora do período do contrato
      // vence sempre, independentemente de existir pagamento nesse mês.
      if (!withinContract) {
        status = "fora";
      } else if (isMonthSettled(paid, expected)) {
        status = "pago";
      } else if (paid >= EPSILON_EUR) {
        status = "parcial";
      } else if (m <= lastDue) {
        status = "falta";
      } else {
        status = "fora"; // dentro do contrato mas ainda não vencido
      }
      return { month: m, status, paid };
    });
    const totalReceived = sum(months.map((m) => m.paid));
    const monthsMissing = months.filter((m) => m.status === "falta").length;
    years.push({ year: y, months, totalReceived, monthsMissing });
  }
  return { contract, years };
}

const HIST_TONE: Record<HistMonthStatus, string> = {
  pago: "bg-emerald-50 text-emerald-700",
  parcial: "bg-amber-50 text-amber-700",
  falta: "bg-red-50 text-red-700",
  fora: "bg-zinc-100 text-zinc-400",
};

function histCellTitle(cell: HistMonthCell): string {
  const label = monthLabel(cell.month);
  switch (cell.status) {
    case "pago":
      return `${label}: pago (${fmtEur(cell.paid, 2)})`;
    case "parcial":
      return `${label}: parcial (${fmtEur(cell.paid, 2)})`;
    case "falta":
      return `${label}: em falta`;
    default:
      return `${label}: fora do período do contrato`;
  }
}

function YearBlock({ block }: { block: HistYearBlock }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-100 p-2.5 sm:flex-row sm:items-center">
      <div className="grid flex-1 grid-cols-6 gap-1 sm:grid-cols-12">
        {block.months.map((cell) => (
          <div
            key={cell.month}
            title={histCellTitle(cell)}
            className={cn(
              "flex h-9 items-center justify-center rounded font-mono text-[10px]",
              HIST_TONE[cell.status],
            )}
          >
            {monthLabel(cell.month, false)}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-100 pt-2 text-xs text-zinc-500 sm:w-40 sm:justify-end sm:border-t-0 sm:border-l sm:pl-3 sm:pt-0">
        <span className="font-medium tabular-nums text-zinc-700">{block.year}</span>
        <span className="tabular-nums">{fmtEur(block.totalReceived)}</span>
        {block.monthsMissing > 0 && <Badge tone="red">{block.monthsMissing} em falta</Badge>}
      </div>
    </div>
  );
}

export default async function FracaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isAdmin } = await getSession();

  const [propQ, ownersQ, landlordsQ, contractsQ, benchQ] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase.from("property_owners").select("*").eq("property_id", id),
    supabase.from("landlords").select("*").order("name"),
    supabase.from("contracts").select("*").eq("property_id", id).order("start_date", { ascending: false }),
    supabase.from("market_benchmarks").select("*"),
  ]);

  const property = propQ.data as Property | null;
  if (!property) notFound();

  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const landlords = (landlordsQ.data ?? []) as Landlord[];
  const contracts = (contractsQ.data ?? []) as Contract[];
  const benchmarks = (benchQ.data ?? []) as MarketBenchmark[];
  const geoOptions = geoOptionsFromBenchmarks(benchmarks);

  // Horizonte de dados da CARTEIRA (não só desta fração): último mês devido não pode passar
  // o último mês importado, senão a grelha marca meses ainda-não-importados como "em falta".
  // Mesmo critério da página de Atrasos (dataHorizonMonth). Query barata: 1 linha.
  const horizonCap = lastDueMonthKey(new Date());

  const contractIds = contracts.map((c) => c.id);
  const [paymentsQ, receiptsQ, expensesQ, updatesQ, horizonQ] = await Promise.all([
    // Histórico COMPLETO (sem piso temporal) — a secção "Histórico de pagamentos" precisa
    // de todos os anos, não só dos últimos 12 meses (PLANO.md/CLAUDE.md: PostgREST corta a
    // 1000 linhas por defeito, daí o .limit() explícito e generoso).
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
  ]);

  const payments = (paymentsQ.data ?? []) as Payment[];
  const receipts = (receiptsQ.data ?? []) as Receipt[];
  const expenses = (expensesQ.data ?? []) as Expense[];
  const rentUpdates = (updatesQ.data ?? []) as RentUpdate[];
  const portfolioHorizon = (horizonQ.data as { ref_month: string }[] | null)?.[0]?.ref_month ?? null;

  const active = contracts.find((c) => c.status === "ativo");
  const mv = marketView(property, active, benchmarks);
  const landlordById = new Map(landlords.map((l) => [l.id, l]));

  const months = lastMonthsKeys(12);

  const expenses12 = expenses.filter((e) => e.expense_date >= months[0]);
  const rent12 = active ? active.rent * 12 : 0;
  const netYield =
    mv.estimatedValue && active ? (rent12 - sum(expenses12.map((e) => e.amount))) / mv.estimatedValue : null;

  // ---------- Histórico completo de pagamentos (Tarefa: "existe mais em atraso além dos
  // últimos 12 meses?"). Um bloco por contrato (fica "unificado" quando só há um). ----------
  const today = new Date();
  // Limitado ao horizonte de dados da carteira (ver query acima) — igual a Atrasos.
  const lastDue = portfolioHorizon ? toMonthKey(portfolioHorizon) : lastDueMonthKey(today);
  const currentYear = today.getFullYear();
  const paymentsByContract = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = paymentsByContract.get(p.contract_id);
    if (list) list.push(p);
    else paymentsByContract.set(p.contract_id, [p]);
  }
  // Mais recente primeiro (contracts já vem ordenado por start_date desc da query).
  const histories: ContractHistory[] = contracts.map((c) =>
    buildContractHistory(c, paymentsByContract.get(c.id) ?? [], lastDue, currentYear),
  );

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

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div>
        <p className="text-xs text-zinc-500">
          <Link href="/fracoes" className="hover:text-teal-700 hover:underline">
            Frações
          </Link>
          <span className="mx-1.5 text-zinc-300">/</span>
          {property.name}
        </p>
        <PageHeader
          className="mt-1"
          title={property.name}
          description={
            [property.address, property.parish, property.municipality].filter(Boolean).join(" · ") ||
            "Sem morada"
          }
          actions={
            isAdmin && (
              <div className="flex flex-wrap gap-2">
                <PropertyFormButton
                  landlords={landlords}
                  geoOptions={geoOptions}
                  property={property}
                  owners={owners}
                  small
                />
                <DeletePropertyButton id={property.id} />
              </div>
            )
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {property.status === "arrendado" ? (
            <Badge tone="green">Arrendado</Badge>
          ) : property.status === "vago" ? (
            <Badge tone="amber">Vago</Badge>
          ) : (
            <Badge tone="zinc">Outro</Badge>
          )}
          {property.typology && <Badge tone="zinc">{property.typology}</Badge>}
          {property.area_m2 && <Badge tone="zinc">{fmtNum(property.area_m2, 0)} m²</Badge>}
          <span className="text-xs text-zinc-500">
            Senhorios:{" "}
            {owners
              .map((o) => `${landlordById.get(o.landlord_id)?.name ?? "?"} (${fmtNum(o.quota, 0)}%)`)
              .join(" + ") || "n/d"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Contrato ativo */}
        <Card
          title="Contrato ativo"
          actions={
            isAdmin && (
              <div className="flex flex-wrap gap-2">
                {active && <RentUpdateButton contract={{ id: active.id, rent: active.rent }} />}
                {active && <ContractFormButton propertyId={property.id} contract={active} />}
                {active && <EndContractButton contractId={active.id} />}
                {!active && <ContractFormButton propertyId={property.id} />}
              </div>
            )
          }
        >
          {active ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Inquilino</dt>
                <dd className="font-medium">{active.tenant_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Renda mensal</dt>
                <dd className="font-semibold tabular-nums text-teal-700">{fmtEur(active.rent, 2)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Início</dt>
                <dd className="tabular-nums">{fmtDate(active.start_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Vencimento</dt>
                <dd className="tabular-nums">dia {active.due_day}</dd>
              </div>
              {active.pf_contract_no && (
                <div>
                  <dt className="text-xs text-zinc-500">Contrato Portal Finanças</dt>
                  <dd className="font-mono text-xs">{active.pf_contract_no}</dd>
                </div>
              )}
              {active.tenant_nif && (
                <div>
                  <dt className="text-xs text-zinc-500">NIF inquilino</dt>
                  <dd className="font-mono text-xs">{active.tenant_nif}</dd>
                </div>
              )}
            </dl>
          ) : (
            <EmptyState icon={Home}>Sem contrato ativo. Fração vaga.</EmptyState>
          )}
        </Card>

        {/* Mercado e valor */}
        <Card title="Mercado e valor" subtitle={mv.benchmark ? `INE ${mv.benchmark.period} · ${mv.benchmark.level === "concelho" ? "mediana do concelho" : "mediana da freguesia"}` : undefined}>
          {mv.benchmark ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Renda atual €/m²</dt>
                <dd className="font-medium tabular-nums">
                  {mv.rentPerM2 !== null ? `${fmtNum(mv.rentPerM2, 2)} €` : "n/d"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Mediana mercado €/m²</dt>
                <dd className="font-medium tabular-nums">
                  {mv.benchmarkRentM2 !== null ? `${fmtNum(mv.benchmarkRentM2, 2)} €` : "n/d"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Desvio vs. mercado</dt>
                <dd><DeviationBadge deviation={mv.deviation} /></dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Potencial por mês</dt>
                <dd className="font-medium text-amber-700 tabular-nums">
                  {mv.gapEurMonth ? `+${fmtEur(mv.gapEurMonth)}` : "n/d"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Valor estimado (mediana venda)</dt>
                <dd className="font-semibold tabular-nums">{fmtEur(mv.estimatedValue)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">VPT</dt>
                <dd className="tabular-nums">
                  {fmtEur(property.vpt)} {property.vpt_year ? `(${property.vpt_year})` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Yield bruto</dt>
                <dd className="tabular-nums">{fmtPct(mv.grossYield, 1)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Yield líquido (12m)</dt>
                <dd className="tabular-nums">{fmtPct(netYield, 1)}</dd>
              </div>
            </dl>
          ) : (
            <EmptyState icon={TrendingUp}>
              Sem benchmark para esta freguesia. Preenche o DICOFRE da fração e importa os dados do
              INE na página Admin.
            </EmptyState>
          )}
          <p className="mt-3 text-[11px] leading-snug text-zinc-400">
            Estimativas com base nas medianas do INE por freguesia (rendas de novos contratos e
            valores de venda): são ordens de grandeza, não avaliações imobiliárias.
          </p>
        </Card>
      </div>

      {/* Histórico completo de pagamentos */}
      <Card
        title="Histórico de pagamentos"
        subtitle="Um bloco por ano civil, desde o início de cada contrato. Marca os pagamentos na página Pagamentos."
      >
        <div
          className={cn(
            "mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
            missingOutside12 > 0
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
        >
          {missingOutside12 > 0 ? (
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <p>
            {missingOutside12 > 0 ? (
              <>
                Meses em falta fora dos últimos 12 meses:{" "}
                <strong className="tabular-nums">{missingOutside12}</strong>
                {referenceRent !== null && (
                  <>
                    {" "}
                    (~<span className="tabular-nums">{fmtEur(missingOutside12 * referenceRent)}</span> à renda
                    atual)
                  </>
                )}
                .
              </>
            ) : (
              "Meses em falta fora dos últimos 12 meses: nenhum."
            )}
          </p>
        </div>

        {histories.length === 0 ? (
          <EmptyState icon={Home}>Sem contratos nesta fração.</EmptyState>
        ) : (
          <div className="space-y-6">
            {histories.map((h) => (
              <div key={h.contract.id}>
                {histories.length > 1 && (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      {h.contract.tenant_name} · {fmtDate(h.contract.start_date)}
                      {h.contract.end_date ? ` a ${fmtDate(h.contract.end_date)}` : " até hoje"}
                    </p>
                    {h.contract.status === "ativo" ? (
                      <Badge tone="green">Ativo</Badge>
                    ) : (
                      <Badge tone="zinc">Cessado</Badge>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  {h.years
                    .slice()
                    .reverse()
                    .map((yb) => (
                      <YearBlock key={yb.year} block={yb} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-100 pt-3 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-emerald-400" aria-hidden="true" />
            Pago
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-amber-400" aria-hidden="true" />
            Parcial
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-red-400" aria-hidden="true" />
            Em falta
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-zinc-300" aria-hidden="true" />
            Fora do período do contrato
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Despesas */}
        <Card
          title="Despesas recentes"
          subtitle={`Últimos 12 meses: ${fmtEur(sum(expenses12.map((e) => e.amount)))}`}
          actions={isAdmin && <ExpenseFormButton properties={[{ id: property.id, name: property.name }]} defaultPropertyId={property.id} />}
        >
          {expenses.length === 0 ? (
            <EmptyState icon={ReceiptText}>Sem despesas registadas.</EmptyState>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <thead>
                    <tr>
                      <Th>Data</Th>
                      <Th>Categoria</Th>
                      <Th>Descrição</Th>
                      <Th className="text-right">Valor</Th>
                      {isAdmin && <Th />}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.slice(0, 12).map((e) => (
                      <tr key={e.id} className="hover:bg-zinc-50">
                        <Td className="whitespace-nowrap tabular-nums">{fmtDate(e.expense_date)}</Td>
                        <Td>{EXPENSE_CATEGORY_LABEL[e.category]}</Td>
                        <Td className="max-w-44 truncate">{e.description ?? "n/d"}</Td>
                        <Td className="text-right tabular-nums">{fmtEur(e.amount, 2)}</Td>
                        {isAdmin && (
                          <Td>
                            <ExpenseFormButton
                              properties={[{ id: property.id, name: property.name }]}
                              expense={e}
                            />
                          </Td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {expenses.slice(0, 12).map((e) => (
                  <div key={e.id} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-800">{EXPENSE_CATEGORY_LABEL[e.category]}</p>
                        <p className="text-xs text-zinc-500">{fmtDate(e.expense_date)}</p>
                      </div>
                      <p className="shrink-0 tabular-nums font-semibold text-zinc-800">{fmtEur(e.amount, 2)}</p>
                    </div>
                    {e.description && <p className="mt-1.5 truncate text-xs text-zinc-500">{e.description}</p>}
                    {isAdmin && (
                      <div className="mt-2 border-t border-zinc-100 pt-2">
                        <ExpenseFormButton
                          properties={[{ id: property.id, name: property.name }]}
                          expense={e}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Recibos */}
        <Card title="Recibos (Portal das Finanças)" subtitle="Importados na página Admin">
          {receipts.length === 0 ? (
            <EmptyState icon={FileText}>Sem recibos importados para esta fração.</EmptyState>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <thead>
                    <tr>
                      <Th className="sticky top-0 z-10 bg-white">Mês</Th>
                      <Th className="sticky top-0 z-10 bg-white">Nº recibo</Th>
                      <Th className="sticky top-0 z-10 bg-white">Emitido</Th>
                      <Th className="sticky top-0 z-10 bg-white text-right">Valor</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.slice(0, 12).map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50">
                        <Td className="font-mono">{monthLabel(r.ref_month)}</Td>
                        <Td className="font-mono">{r.receipt_number ?? "n/d"}</Td>
                        <Td className="tabular-nums">{fmtDate(r.issue_date)}</Td>
                        <Td className="text-right tabular-nums">{fmtEur(r.amount, 2)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {receipts.slice(0, 12).map((r) => (
                  <div key={r.id} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm font-medium text-zinc-800">{monthLabel(r.ref_month)}</p>
                      <p className="tabular-nums font-semibold text-zinc-800">{fmtEur(r.amount, 2)}</p>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                      <span className="font-mono">{r.receipt_number ?? "n/d"}</span>
                      <span className="tabular-nums">{fmtDate(r.issue_date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Histórico de contratos e rendas */}
      <Card title="Histórico de contratos e atualizações de renda">
        {contracts.length === 0 ? (
          <EmptyState icon={Home}>Sem contratos.</EmptyState>
        ) : (
          <div className="space-y-3">
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Inquilino</Th>
                    <Th>Início</Th>
                    <Th>Fim</Th>
                    <Th className="text-right">Renda</Th>
                    <Th>Estado</Th>
                    {isAdmin && <Th />}
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50">
                      <Td>{c.tenant_name}</Td>
                      <Td className="tabular-nums">{fmtDate(c.start_date)}</Td>
                      <Td className="tabular-nums">{fmtDate(c.end_date)}</Td>
                      <Td className="text-right tabular-nums">{fmtEur(c.rent, 2)}</Td>
                      <Td>
                        {c.status === "ativo" ? (
                          <Badge tone="green">Ativo</Badge>
                        ) : (
                          <Badge tone="zinc">Cessado</Badge>
                        )}
                      </Td>
                      {isAdmin && (
                        <Td>
                          <div className="flex gap-1">
                            <ContractFormButton propertyId={property.id} contract={c} label="Editar" />
                            <DeleteContractButton id={c.id} />
                          </div>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div className="space-y-2 md:hidden">
              {contracts.map((c) => (
                <div key={c.id} className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-800">{c.tenant_name}</p>
                    {c.status === "ativo" ? (
                      <Badge tone="green">Ativo</Badge>
                    ) : (
                      <Badge tone="zinc">Cessado</Badge>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                    <span>
                      Início <span className="tabular-nums text-zinc-700">{fmtDate(c.start_date)}</span>
                    </span>
                    <span>
                      Fim <span className="tabular-nums text-zinc-700">{fmtDate(c.end_date)}</span>
                    </span>
                  </div>
                  <p className="mt-1.5 tabular-nums font-semibold text-teal-700">{fmtEur(c.rent, 2)}</p>
                  {isAdmin && (
                    <div className="mt-2 flex gap-1 border-t border-zinc-100 pt-2">
                      <ContractFormButton propertyId={property.id} contract={c} label="Editar" />
                      <DeleteContractButton id={c.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {rentUpdates.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Atualizações de renda
                </p>
                <ul className="space-y-1 text-sm text-zinc-600">
                  {rentUpdates.map((u) => (
                    <li key={u.id} className="tabular-nums">
                      {fmtDate(u.effective_date)}: {fmtEur(u.old_rent, 2)} → {fmtEur(u.new_rent, 2)}{" "}
                      <span className="text-xs text-zinc-400">({u.reason})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
