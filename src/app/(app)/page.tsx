import Link from "next/link";
import { AlertCircle, CheckCircle2, DoorOpen, Target, TrendingUp, Wallet } from "lucide-react";
import {
  CollectionRateChart,
  MonthlyFlowChart,
  type CollectionRateDatum,
  type MonthlyFlowDatum,
} from "@/components/charts";
import { Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { expensesInMonth, marketView, monthRoll, sum } from "@/lib/calc";
import { computeArrears } from "@/lib/arrears";
import { fetchAllPayments, getSession } from "@/lib/data";
import {
  addMonthsKey,
  currentMonthKey,
  fmtEur,
  fmtPct,
  lastMonthsKeys,
  monthLabel,
} from "@/lib/format";
import type { Contract, Expense, Landlord, MarketBenchmark, Property, Receipt } from "@/lib/types";
import { DeviationBadge } from "./fracoes/properties-table";

export const dynamic = "force-dynamic";

function collectionTone(taxa: number): "green" | "amber" | "red" {
  if (taxa >= 1) return "green";
  if (taxa >= 0.8) return "amber";
  return "red";
}

export default async function DashboardPage() {
  const { supabase } = await getSession();

  const months = lastMonthsKeys(12);
  const fetchFloor = lastMonthsKeys(13)[0];
  const thisMonth = currentMonthKey();

  const [propsQ, contractsQ, landlordsQ, benchQ, payments, expensesQ, receiptsMonthQ] =
    await Promise.all([
      supabase.from("properties").select("*"),
      supabase.from("contracts").select("*"),
      supabase.from("landlords").select("*"),
      supabase.from("market_benchmarks").select("*"),
      // Histórico COMPLETO e paginado (mesma fonte da tab de Atrasos) — os atrasos do dashboard
      // passam pela mesma computeArrears, por isso precisam do histórico todo, não só de 12 meses.
      fetchAllPayments(supabase),
      supabase.from("expenses").select("*").gte("expense_date", fetchFloor),
      // Checklist "Este mês": a fonte são os RECIBOS (o que foi emitido no Portal), não os
      // pagamentos. Um mês só tem tantas linhas como contratos ativos — bem abaixo das 1000.
      supabase.from("receipts").select("contract_id,pf_contract_no").eq("ref_month", thisMonth),
    ]);

  const properties = (propsQ.data ?? []) as Property[];
  const contracts = (contractsQ.data ?? []) as Contract[];
  // Pedido no fetch para uso futuro (ex.: filtro por senhorio); esta versão do
  // dashboard ainda não tem nenhum elemento que o mostre.
  const landlords = (landlordsQ.data ?? []) as Landlord[];
  const benchmarks = (benchQ.data ?? []) as MarketBenchmark[];
  const expenses = (expensesQ.data ?? []) as Expense[];

  if (properties.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description={monthLabel(currentMonthKey())} />
        <Card title="Bem-vindo">
          <p className="text-sm text-zinc-600">
            Começa por importar os recibos do Portal das Finanças em{" "}
            <Link href="/admin" className="font-medium text-teal-700 hover:underline">
              Admin → Importar
            </Link>
            , ou cria frações manualmente em{" "}
            <Link href="/fracoes" className="font-medium text-teal-700 hover:underline">
              Frações
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  const propertiesById = new Map(properties.map((p) => [p.id, p]));

  // ---------- Fluxo mensal (12 meses) ----------
  const monthAggs = months.map((m) => {
    const roll = monthRoll(m, contracts, payments, propertiesById);
    const esperado = sum(roll.map((r) => r.expected));
    const recebido = sum(roll.map((r) => r.payment?.amount));
    const despesasMes = sum(expensesInMonth(expenses, m).map((e) => e.amount));
    const liquido = recebido - despesasMes;
    const taxa = esperado > 0 ? recebido / esperado : 0;
    const isJan = m.slice(5, 7) === "01";
    return {
      month: m,
      label: monthLabel(m, isJan),
      esperado,
      recebido,
      despesas: despesasMes,
      liquido,
      taxa,
    };
  });

  const flowData: MonthlyFlowDatum[] = monthAggs.map(
    ({ month, label, esperado, recebido, despesas, liquido }) => ({
      month,
      label,
      esperado,
      recebido,
      despesas,
      liquido,
    }),
  );
  const rateData: CollectionRateDatum[] = monthAggs.map(({ label, taxa }) => ({ label, taxa }));
  const currentAgg = monthAggs[monthAggs.length - 1];

  // ---------- Rendas em atraso ----------
  // Fonte ÚNICA: a MESMA computeArrears da página de Atrasos (renda de referência, horizonte de
  // dados, cadência, contratos cessados sem baixa). Antes o dashboard tinha lógica própria
  // (janela 12m, renda inteira por mês) que divergia da tab — daí os números não baterem certo.
  const activeContracts = contracts.filter((c) => c.status === "ativo");
  const { rows: arrearsRows, summary: arrearsSummary } = computeArrears(
    activeContracts,
    payments,
    new Date(),
  );
  const lateRows = arrearsRows
    .filter((r) => r.streak >= 1 && r.severity !== "ritmo_proprio")
    .sort((a, b) => b.debt - a.debt || b.streak - a.streak)
    .map((r) => ({
      contractId: r.contractId,
      property: propertiesById.get(r.propertyId),
      tenantName: r.tenantName,
      monthsLate: r.streak,
      totalLate: r.debt,
      stale: r.stale,
    }));

  // ---------- Este mês: recibos por emitir (P1-3) ----------
  // Emitido = existe recibo do mês para o contrato. Os recibos importados trazem contract_id,
  // mas os que ainda não foram reconciliados só têm o nº de contrato do Portal — aceitam-se os
  // dois como prova de emissão.
  const issued = new Set<string>();
  for (const r of (receiptsMonthQ.data ?? []) as Array<Partial<Receipt>>) {
    if (r.contract_id) issued.add(r.contract_id);
    if (r.pf_contract_no) issued.add(r.pf_contract_no);
  }
  const arrearsById = new Map(arrearsRows.map((r) => [r.contractId, r]));
  const toIssue = activeContracts
    .filter((c) => {
      if (issued.has(c.id) || (c.pf_contract_no && issued.has(c.pf_contract_no))) return false;
      // Contratos de cadência própria (ex.: trimestral) só entram no mês em que voltam a vencer.
      const row = arrearsById.get(c.id);
      const cadence = row?.cadence ?? 1;
      if (cadence >= 2 && row?.lastPaidMonth) {
        return addMonthsKey(row.lastPaidMonth, cadence) <= thisMonth;
      }
      return true;
    })
    .map((c) => ({ contract: c, property: propertiesById.get(c.property_id) }))
    .sort((a, b) => (a.property?.name ?? "").localeCompare(b.property?.name ?? "", "pt"));

  // ---------- Ocupação (P2-9) ----------
  // Ocupada = tem contrato ativo. Deriva dos contratos e não de properties.status, que é um
  // campo manual que fica desatualizado quando um contrato cessa.
  const occupiedIds = new Set(activeContracts.map((c) => c.property_id));
  const vacant = properties.filter((p) => !occupiedIds.has(p.id));
  const occupancy = properties.length > 0 ? occupiedIds.size / properties.length : 0;

  // ---------- Vs. mercado ----------
  const marketRows = properties.map((p) => {
    const active = contracts.find((c) => c.property_id === p.id && c.status === "ativo");
    const mv = marketView(p, active, benchmarks);
    return { property: p, mv };
  });
  const marketPotential = sum(marketRows.map((r) => r.mv.gapEurMonth));
  const belowMarket = marketRows
    .filter((r) => r.mv.deviation !== null && r.mv.deviation < 0)
    .sort((a, b) => (a.mv.deviation ?? 0) - (b.mv.deviation ?? 0))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" description={monthLabel(currentMonthKey())} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Recebido este mês"
          value={fmtEur(currentAgg.recebido)}
          sub={`de ${fmtEur(currentAgg.esperado)} esperados · taxa ${fmtPct(currentAgg.taxa, 0)}`}
          tone={collectionTone(currentAgg.taxa)}
          icon={Wallet}
        />
        <Link
          href="/atrasos"
          className="block rounded-lg transition-shadow duration-150 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          <StatCard
            label="Rendas em falta"
            value={arrearsSummary.contractsInArrears}
            sub={`${fmtEur(arrearsSummary.totalDebt)} de dívida estimada · ver Atrasos`}
            tone={arrearsSummary.contractsInArrears > 0 ? "red" : "green"}
            icon={AlertCircle}
          />
        </Link>
        <StatCard
          label="Lucro do mês"
          value={fmtEur(currentAgg.liquido)}
          sub={`despesas: ${fmtEur(currentAgg.despesas)}`}
          tone="teal"
          icon={TrendingUp}
        />
        <StatCard
          label="Potencial de mercado"
          value={fmtEur(marketPotential)}
          sub="por mês, se rendas à mediana INE"
          tone="amber"
          icon={Target}
        />
        <Link
          href="/fracoes"
          className="block rounded-lg transition-shadow duration-150 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          <StatCard
            label="Ocupação"
            value={fmtPct(occupancy, 0)}
            sub={
              vacant.length === 0
                ? `${properties.length} frações, todas arrendadas`
                : `${vacant.length} sem contrato ativo: ${vacant
                    .slice(0, 3)
                    .map((p) => p.name)
                    .join(", ")}${vacant.length > 3 ? "…" : ""}`
            }
            tone={vacant.length === 0 ? "green" : "zinc"}
            icon={DoorOpen}
          />
        </Link>
      </div>

      <Card
        title="Este mês: recibos por emitir"
        subtitle={`${monthLabel(thisMonth)} · contratos ativos ainda sem recibo emitido`}
        actions={
          <a
            href="https://imoveis.portaldasfinancas.gov.pt/arrendamento/consultarRecibos.action"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            Abrir Portal das Finanças
          </a>
        }
      >
        {toIssue.length === 0 ? (
          <EmptyState icon={CheckCircle2}>
            Todos os contratos ativos já têm recibo deste mês.
          </EmptyState>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {toIssue.map(({ contract, property }) => (
              <div
                key={contract.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 p-3"
              >
                <div className="min-w-0">
                  {property ? (
                    <Link
                      href={`/fracoes/${property.id}`}
                      className="font-medium text-teal-700 hover:underline"
                    >
                      {property.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-zinc-700">?</span>
                  )}
                  <p className="truncate text-xs text-zinc-500">{contract.tenant_name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular-nums font-semibold text-zinc-900">
                    {fmtEur(contract.rent)}
                  </p>
                  {contract.pf_contract_no && (
                    <p className="font-mono text-xs text-zinc-400">{contract.pf_contract_no}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Últimos 12 meses">
        <MonthlyFlowChart data={flowData} />
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <p className="mb-1 text-xs font-medium text-zinc-500">Taxa de cobrança mensal</p>
          <CollectionRateChart data={rateData} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Rendas em atraso">
          {lateRows.length === 0 ? (
            <EmptyState icon={CheckCircle2}>Sem rendas em atraso.</EmptyState>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <thead>
                    <tr>
                      <Th>Fração</Th>
                      <Th>Inquilino</Th>
                      <Th className="text-right">Meses em atraso</Th>
                      <Th className="text-right">Dívida estimada</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {lateRows.map((r) => (
                      <tr key={r.contractId} className="hover:bg-zinc-50">
                        <Td>
                          {r.property ? (
                            <Link
                              href={`/fracoes/${r.property.id}`}
                              className="font-medium text-teal-700 hover:underline"
                            >
                              {r.property.name}
                            </Link>
                          ) : (
                            "?"
                          )}
                        </Td>
                        <Td>{r.tenantName}</Td>
                        <Td className="text-right tabular-nums">{r.monthsLate}</Td>
                        <Td className="text-right tabular-nums text-red-700">
                          {r.stale ? "·" : fmtEur(r.totalLate)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {lateRows.map((r) => (
                  <div
                    key={r.contractId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 p-3"
                  >
                    <div className="min-w-0">
                      {r.property ? (
                        <Link
                          href={`/fracoes/${r.property.id}`}
                          className="font-medium text-teal-700 hover:underline"
                        >
                          {r.property.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-zinc-700">?</span>
                      )}
                      <p className="truncate text-xs text-zinc-500">{r.tenantName}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular-nums font-semibold text-red-700">
                        {r.stale ? "·" : fmtEur(r.totalLate)}
                      </p>
                      <p className="tabular-nums text-xs text-zinc-500">
                        {r.monthsLate} {r.monthsLate === 1 ? "mês" : "meses"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card title="Mais abaixo do mercado">
          {belowMarket.length === 0 ? (
            <EmptyState icon={TrendingUp}>
              {benchmarks.length === 0 ? (
                <>
                  Ainda não há benchmarks INE carregados. Vai a <strong>Admin → Benchmarks INE</strong>{" "}
                  para importar as medianas por freguesia.
                </>
              ) : (
                "Nenhuma fração está abaixo da mediana do mercado."
              )}
            </EmptyState>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <thead>
                    <tr>
                      <Th>Fração</Th>
                      <Th>Desvio</Th>
                      <Th className="text-right">Potencial/mês</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {belowMarket.map((r) => (
                      <tr key={r.property.id} className="hover:bg-zinc-50">
                        <Td>
                          <Link
                            href={`/fracoes/${r.property.id}`}
                            className="font-medium text-teal-700 hover:underline"
                          >
                            {r.property.name}
                          </Link>
                        </Td>
                        <Td><DeviationBadge deviation={r.mv.deviation} /></Td>
                        <Td className="text-right tabular-nums text-amber-700">
                          {r.mv.gapEurMonth ? `+${fmtEur(r.mv.gapEurMonth)}` : "n/d"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {belowMarket.map((r) => (
                  <div
                    key={r.property.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 p-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/fracoes/${r.property.id}`}
                        className="font-medium text-teal-700 hover:underline"
                      >
                        {r.property.name}
                      </Link>
                      <div className="mt-1">
                        <DeviationBadge deviation={r.mv.deviation} />
                      </div>
                    </div>
                    <p className="shrink-0 tabular-nums font-semibold text-amber-700">
                      {r.mv.gapEurMonth ? `+${fmtEur(r.mv.gapEurMonth)}` : "n/d"}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <p className="text-xs text-zinc-400">
        Ver também{" "}
        <Link href="/mercado" className="text-teal-700 hover:underline">
          Mercado
        </Link>{" "}
        e{" "}
        <Link href="/pagamentos" className="text-teal-700 hover:underline">
          Pagamentos
        </Link>
        .
      </p>
    </div>
  );
}
