import Link from "next/link";
import { Building2, Percent, Target, TriangleAlert } from "lucide-react";
import { Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { currentProperties, marketView, sum } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { fmtEur, fmtNum, fmtPct } from "@/lib/format";
import type { Contract, MarketBenchmark, Property } from "@/lib/types";
import { DeviationBadge } from "../fracoes/properties-table";

export const dynamic = "force-dynamic";

export default async function MercadoPage() {
  const { supabase } = await getSession();

  const [propsQ, contractsQ, benchQ] = await Promise.all([
    supabase.from("properties").select("*"),
    supabase.from("contracts").select("*").eq("status", "ativo"),
    supabase.from("market_benchmarks").select("*"),
  ]);

  // P0-2c: terrenos e imóveis vendidos saem da comparação de mercado (não são
  // arrendáveis / já não são da família).
  const properties = currentProperties((propsQ.data ?? []) as Property[]);
  const contracts = (contractsQ.data ?? []) as Contract[];
  const benchmarks = (benchQ.data ?? []) as MarketBenchmark[];

  const rows = properties
    .map((p) => {
      const active = contracts.find((c) => c.property_id === p.id);
      const mv = marketView(p, active, benchmarks);
      return { property: p, contract: active, mv };
    })
    .sort((a, b) => {
      const da = a.mv.deviation ?? Number.POSITIVE_INFINITY;
      const db = b.mv.deviation ?? Number.POSITIVE_INFINITY;
      return da - db;
    });

  const withDev = rows.filter((r) => r.mv.deviation !== null);
  const totalGap = sum(rows.map((r) => r.mv.gapEurMonth));
  const nBelow = withDev.filter((r) => r.mv.deviation! <= -0.1).length;
  const withValue = rows.filter((r) => r.mv.estimatedValue !== null);
  const portfolioValue = sum(withValue.map((r) => r.mv.estimatedValue));
  const totalRentYear = sum(withValue.map((r) => (r.contract?.rent ?? 0) * 12));
  const avgYield = portfolioValue > 0 ? totalRentYear / portfolioValue : null;

  const missingData = rows.filter(
    (r) => r.contract && (r.mv.deviation === null || r.mv.estimatedValue === null),
  ).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mercado"
        description="Comparação das rendas atuais com as medianas do INE por freguesia (novos contratos de arrendamento) e estimativa de valor pelos preços medianos de venda."
      />

      {benchmarks.length === 0 ? (
        <EmptyState icon={TriangleAlert}>
          Ainda não há benchmarks carregados. Vai a <strong>Admin → Benchmarks INE</strong> para
          importar as medianas por freguesia, e preenche o DICOFRE e a área de cada fração.
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Potencial por mês (rendas abaixo do mercado)"
              value={totalGap > 0 ? `+${fmtEur(totalGap)}` : fmtEur(0)}
              sub={`${fmtEur(totalGap * 12)} por ano, se tudo fosse posto à mediana`}
              tone="amber"
              icon={Target}
            />
            <StatCard
              label="Frações ≥10% abaixo do mercado"
              value={nBelow}
              sub={`em ${withDev.length} frações com dados`}
              tone={nBelow > 0 ? "red" : "green"}
              icon={TriangleAlert}
            />
            <StatCard
              label="Valor estimado da carteira"
              value={fmtEur(portfolioValue)}
              sub={`${withValue.length} frações com área e benchmark`}
              tone="teal"
              icon={Building2}
            />
            <StatCard
              label="Yield bruto médio"
              value={fmtPct(avgYield, 1)}
              sub="rendas anuais / valor estimado"
              icon={Percent}
            />
          </div>

          <Card
            title="Frações vs. mercado"
            subtitle="Ordenado das mais abaixo do mercado para as mais acima"
          >
            {/* Desktop/tablet */}
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Fração</Th>
                    <Th>Freguesia</Th>
                    <Th className="text-right">Renda</Th>
                    <Th className="text-right">€/m²</Th>
                    <Th className="text-right">Mediana €/m²</Th>
                    <Th>Desvio</Th>
                    <Th className="text-right">Potencial/mês</Th>
                    <Th className="text-right">Valor estimado</Th>
                    <Th className="text-right">Yield bruto</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ property, contract, mv }) => (
                    <tr key={property.id} className="hover:bg-zinc-50">
                      <Td>
                        <Link
                          href={`/fracoes/${property.id}`}
                          className="font-medium text-teal-700 hover:underline"
                        >
                          {property.name}
                        </Link>
                      </Td>
                      <Td>
                        {property.parish ?? "n/d"}
                        {mv.benchmark?.level === "concelho" && (
                          <span className="ml-1 text-[10px] text-zinc-400">(mediana concelho)</span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{fmtEur(contract?.rent ?? null)}</Td>
                      <Td className="text-right tabular-nums">
                        {mv.rentPerM2 !== null ? fmtNum(mv.rentPerM2, 1) : "n/d"}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {mv.benchmarkRentM2 !== null ? fmtNum(mv.benchmarkRentM2, 1) : "n/d"}
                      </Td>
                      <Td><DeviationBadge deviation={mv.deviation} /></Td>
                      <Td className="text-right tabular-nums text-amber-700">
                        {mv.gapEurMonth ? `+${fmtEur(mv.gapEurMonth)}` : "n/d"}
                      </Td>
                      <Td className="text-right tabular-nums">{fmtEur(mv.estimatedValue)}</Td>
                      <Td className="text-right tabular-nums">{fmtPct(mv.grossYield, 1)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {/* Mobile: um cartão por fração, com todos os dados da linha. */}
            <div className="space-y-2 md:hidden">
              {rows.map(({ property, contract, mv }) => (
                <div key={property.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/fracoes/${property.id}`}
                      className="font-medium text-teal-700 hover:underline"
                    >
                      {property.name}
                    </Link>
                    <DeviationBadge deviation={mv.deviation} />
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {property.parish ?? "n/d"}
                    {mv.benchmark?.level === "concelho" && " (mediana concelho)"}
                  </p>
                  <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                    <div>
                      <p className="text-[11px] text-zinc-400">Renda</p>
                      <p className="tabular-nums font-medium text-zinc-800">{fmtEur(contract?.rent ?? null)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-400">€/m² (atual / mediana)</p>
                      <p className="tabular-nums text-zinc-700">
                        {mv.rentPerM2 !== null ? fmtNum(mv.rentPerM2, 1) : "n/d"} /{" "}
                        {mv.benchmarkRentM2 !== null ? fmtNum(mv.benchmarkRentM2, 1) : "n/d"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-400">Potencial/mês</p>
                      <p className="tabular-nums text-amber-700">
                        {mv.gapEurMonth ? `+${fmtEur(mv.gapEurMonth)}` : "n/d"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-400">Valor estimado</p>
                      <p className="tabular-nums text-zinc-800">{fmtEur(mv.estimatedValue)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] text-zinc-400">Yield bruto</p>
                      <p className="tabular-nums text-zinc-800">{fmtPct(mv.grossYield, 1)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {missingData > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                {missingData} fração(ões) arrendada(s) sem dados suficientes: preenche a área (m²)
                e o DICOFRE na ficha de cada uma.
              </p>
            )}
            <p className="mt-2 text-[11px] leading-snug text-zinc-400">
              As medianas do INE referem-se a NOVOS contratos: dizem quanto se cobraria hoje, não o
              que é legalmente possível aumentar num contrato existente (isso segue o coeficiente
              anual e a lei do arrendamento; ver roadmap Contratos &amp; alertas). Estimativas de
              valor = área × mediana de venda da freguesia: ordem de grandeza, não avaliação.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
