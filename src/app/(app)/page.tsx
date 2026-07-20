import Link from "next/link";
import { AlertCircle, CheckCircle2, Target, TrendingUp, Wallet } from "lucide-react";
import {
  CollectionRateChart,
  MonthlyFlowChart,
  type CollectionRateDatum,
  type MonthlyFlowDatum,
} from "@/components/charts";
import { Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { contractActiveInMonth, expensesInMonth, marketView, monthRoll, sum } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { currentMonthKey, fmtEur, fmtPct, lastMonthsKeys, monthLabel, todayISO } from "@/lib/format";
import type { Contract, Expense, Landlord, MarketBenchmark, Payment, Property } from "@/lib/types";
import { DeviationBadge } from "./fracoes/properties-table";

export const dynamic = "force-dynamic";

function collectionTone(taxa: number): "green" | "amber" | "red" {
  if (taxa >= 1) return "green";
  if (taxa >= 0.8) return "amber";
  return "red";
}

interface LateAgg {
  contract: Contract;
  property: Property | undefined;
  monthsLate: number;
  totalLate: number;
}

export default async function DashboardPage() {
  const { supabase } = await getSession();

  const months = lastMonthsKeys(12);
  const fetchFloor = lastMonthsKeys(13)[0];

  const [propsQ, contractsQ, landlordsQ, benchQ, paymentsQ, expensesQ] = await Promise.all([
    supabase.from("properties").select("*"),
    supabase.from("contracts").select("*"),
    supabase.from("landlords").select("*"),
    supabase.from("market_benchmarks").select("*"),
    supabase.from("payments").select("*").gte("ref_month", fetchFloor),
    supabase.from("expenses").select("*").gte("expense_date", fetchFloor),
  ]);

  const properties = (propsQ.data ?? []) as Property[];
  const contracts = (contractsQ.data ?? []) as Contract[];
  // Pedido no fetch para uso futuro (ex.: filtro por senhorio); esta versão do
  // dashboard ainda não tem nenhum elemento que o mostre.
  const landlords = (landlordsQ.data ?? []) as Landlord[];
  const benchmarks = (benchQ.data ?? []) as MarketBenchmark[];
  const payments = (paymentsQ.data ?? []) as Payment[];
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
  // Mesma lógica de "falta" da grelha de Pagamentos (payments-grid.tsx: cellState):
  // passado sem pagamento = falta; mês atual só é falta depois do dia de vencimento.
  const current = currentMonthKey();
  const today = todayISO();
  const dayOfMonth = parseInt(today.slice(8, 10), 10);
  const payMap = new Map(payments.map((p) => [`${p.contract_id}:${p.ref_month.slice(0, 7)}`, p]));

  function isLate(contract: Contract, m: string): boolean {
    if (!contractActiveInMonth(contract, m)) return false;
    if (payMap.has(`${contract.id}:${m.slice(0, 7)}`)) return false;
    if (m < current) return true;
    if (m === current) return dayOfMonth > contract.due_day;
    return false;
  }

  const lateRows: LateAgg[] = contracts
    .map((c) => {
      let monthsLate = 0;
      let totalLate = 0;
      for (const m of months) {
        if (isLate(c, m)) {
          monthsLate += 1;
          totalLate += c.rent;
        }
      }
      return { contract: c, property: propertiesById.get(c.property_id), monthsLate, totalLate };
    })
    .filter((r) => r.monthsLate > 0)
    .sort((a, b) => b.totalLate - a.totalLate);

  const totalLateAmount = sum(lateRows.map((r) => r.totalLate));

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
            value={lateRows.length}
            sub={`${fmtEur(totalLateAmount)} total em falta · ver Atrasos`}
            tone={lateRows.length > 0 ? "red" : "green"}
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
      </div>

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
            <Table>
              <thead>
                <tr>
                  <Th>Fração</Th>
                  <Th>Inquilino</Th>
                  <Th className="text-right">Meses em falta</Th>
                  <Th className="text-right">€</Th>
                </tr>
              </thead>
              <tbody>
                {lateRows.map((r) => (
                  <tr key={r.contract.id} className="hover:bg-zinc-50">
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
                    <Td>{r.contract.tenant_name}</Td>
                    <Td className="text-right tabular-nums">{r.monthsLate}</Td>
                    <Td className="text-right tabular-nums text-red-700">{fmtEur(r.totalLate)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
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
