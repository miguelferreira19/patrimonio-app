import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Percent, Target, TriangleAlert } from "lucide-react";
import { Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { sum } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { getSnapshotLeve } from "@/lib/portfolio";
import { fmtEur, fmtNum, fmtPct } from "@/lib/format";
import { DeviationBadge } from "@/components/kit/badges";

export const dynamic = "force-dynamic";

export default async function MercadoPage() {
  // V3: superficie de administracao. Enquanto a `area_m2` estiver por preencher, o desvio
  // face ao INE e o valor estimado sao nulos na maioria das fracoes — e uma pagina que
  // responde "n/d" a quem so a abre duas vezes por ano nao merece um lugar no rail.
  const { isAdmin } = await getSession();
  if (!isAdmin) redirect("/");

  // Fase 1: o marketView de cada fracao ja vem calculado no snapshot (PLANO.md §7.1).
  // P0-2c continua garantido: `correntes` exclui terrenos e imoveis vendidos.
  const snap = await getSnapshotLeve();

  const rows = snap.correntes
    .map((a) => ({ property: a.property, contract: a.activeContract ?? undefined, mv: a.mercado }))
    .sort((a, b) => {
      const da = a.mv.deviation ?? Number.POSITIVE_INFINITY;
      const db = b.mv.deviation ?? Number.POSITIVE_INFINITY;
      return da - db;
    });

  // "Sem benchmarks carregados" e agora derivado do proprio snapshot: se nenhuma fracao
  // encontrou territorio no INE, nao ha nada para comparar.
  const benchmarksCarregados = snap.ativos.some((a) => a.mercado.benchmark !== undefined);

  const withDev = rows.filter((r) => r.mv.deviation !== null);
  const totalGap = snap.mercado.potencialMes;
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
        description="Comparação das rendas atuais com as medianas do INE (novos contratos de arrendamento) e estimativa de valor pelos preços medianos de venda. O INE só publica ~330 freguesias: fora dessas, e é o caso de toda esta carteira, a mediana é a do CONCELHO. Só habitação — loja, garagem e arrecadação não se comparam a medianas de alojamentos."
      />

      {!benchmarksCarregados ? (
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
                    <tr key={property.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                      <Td>
                        <Link
                          href={`/fracoes/${property.id}`}
                          className="font-medium text-teal-700 hover:underline dark:text-teal-400"
                        >
                          {property.name}
                        </Link>
                      </Td>
                      <Td>
                        {property.parish ?? "n/d"}
                        {mv.benchmark?.level === "concelho" && (
                          <span className="ml-1 text-[10px] text-zinc-400 dark:text-zinc-500">(mediana concelho)</span>
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
                      <Td className="text-right tabular-nums text-amber-700 dark:text-amber-400">
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
                <div key={property.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/fracoes/${property.id}`}
                      className="font-medium text-teal-700 hover:underline dark:text-teal-400"
                    >
                      {property.name}
                    </Link>
                    <DeviationBadge deviation={mv.deviation} />
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {property.parish ?? "n/d"}
                    {mv.benchmark?.level === "concelho" && " (mediana concelho)"}
                  </p>
                  <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                    <div>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Renda</p>
                      <p className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">{fmtEur(contract?.rent ?? null)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">€/m² (atual / mediana)</p>
                      <p className="tabular-nums text-zinc-700 dark:text-zinc-300">
                        {mv.rentPerM2 !== null ? fmtNum(mv.rentPerM2, 1) : "n/d"} /{" "}
                        {mv.benchmarkRentM2 !== null ? fmtNum(mv.benchmarkRentM2, 1) : "n/d"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Potencial/mês</p>
                      <p className="tabular-nums text-amber-700 dark:text-amber-400">
                        {mv.gapEurMonth ? `+${fmtEur(mv.gapEurMonth)}` : "n/d"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Valor estimado</p>
                      <p className="tabular-nums text-zinc-800 dark:text-zinc-200">{fmtEur(mv.estimatedValue)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Yield bruto</p>
                      <p className="tabular-nums text-zinc-800 dark:text-zinc-200">{fmtPct(mv.grossYield, 1)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {missingData > 0 && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                {missingData} fração(ões) arrendada(s) sem dados suficientes: preenche a área (m²)
                e o DICOFRE na ficha de cada uma.
              </p>
            )}
            <p className="mt-2 text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">
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
