// MERCADO. Desde 2026-07-29 é destino de TODA a gente, a pedido do utilizador: saiu da
// administração quando não tinha números para mostrar (área por preencher em quase toda a
// carteira, e o código de território errado — bug B5), e essas duas razões desapareceram.
//
// Por ser agora uma superfície de família, foi reescrita no idioma da V3: um número herói
// em vez de um `PageHeader` com um parágrafo (R1), hairlines em vez de uma grelha de
// `StatCard` (R2), e o "porquê" de cada limitação encostado ao número a que se aplica, em
// vez de um rodapé de letra miúda que ninguém lê (R3).
//
// A HONESTIDADE DESTA PÁGINA, que é o mais fácil de estragar aqui:
//  - as medianas do INE são de ALOJAMENTOS FAMILIARES e de NOVOS contratos. Dizem quanto
//    se cobraria hoje, não o que é legal aumentar num contrato em vigor;
//  - o INE só publica ~330 freguesias, e nenhuma é desta carteira: a mediana é a do
//    CONCELHO, e isso tem de estar à vista, não numa nota de rodapé;
//  - loja, garagem e arrecadação não têm benchmark (`benchmarkForMetric` em calc.ts) —
//    comparar uma garagem com a mediana de habitação não é uma estimativa fraca, é uma
//    comparação sem significado.

import Link from "next/link";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { Confianca, Figure, Lede, Money, Seccao } from "@/components/kit";
import { DeviationBadge } from "@/components/kit/badges";
import { sum } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { getSnapshotLeve } from "@/lib/portfolio";
import { fmtEur, fmtNum, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MercadoPage() {
  await getSession();

  // Fase 1: o marketView de cada fração já vem calculado no snapshot (PLANO.md §7.1).
  // P0-2c continua garantido: `correntes` exclui terrenos e imóveis vendidos.
  const snap = await getSnapshotLeve();

  const linhas = snap.correntes
    .map((a) => ({ property: a.property, contract: a.activeContract ?? undefined, mv: a.mercado }))
    .sort((a, b) => (a.mv.deviation ?? Infinity) - (b.mv.deviation ?? Infinity));

  const comparaveis = linhas.filter((r) => r.mv.benchmark !== undefined);
  const comDesvio = linhas.filter((r) => r.mv.deviation !== null);
  const comValor = linhas.filter((r) => r.mv.estimatedValue !== null);

  const potencialMes = snap.mercado.potencialMes;
  const abaixo = comDesvio.filter((r) => r.mv.deviation! <= -0.1);
  const valorCarteira = sum(comValor.map((r) => r.mv.estimatedValue));
  const rendaAnual = sum(comValor.map((r) => (r.contract?.rent ?? 0) * 12));
  const yieldMedio = valorCarteira > 0 ? rendaAnual / valorCarteira : null;

  const semDados = linhas.filter((r) => r.contract && r.mv.benchmark === undefined).length;
  const porConcelho = comparaveis.filter((r) => r.mv.benchmark?.level === "concelho").length;

  if (comparaveis.length === 0) {
    return (
      <div className="space-y-6">
        <Lede eyebrow="Mercado" title="Ainda não há com que comparar.">
          Nenhuma fração encontrou território no INE. Em <strong>Admin</strong>, atualiza os
          benchmarks e confirma a freguesia e a área nas fichas.
        </Lede>
        <EmptyState icon={Building2}>Sem medianas carregadas.</EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Lede eyebrow="Mercado" title={<Money value={valorCarteira} escala="hero" />}>
        O que a carteira valeria hoje, em {comValor.length} de {linhas.length} frações: as que têm
        área medida e mediana de venda do INE.{" "}
        <Confianca
          nivel="estimado"
          conta={`Σ área × mediana de venda (€/m²) das ${comValor.length} frações de habitação com área conhecida = ${fmtEur(valorCarteira)}. É uma ordem de grandeza a partir de medianas públicas, nunca uma avaliação.`}
        />
      </Lede>

      <Seccao titulo="Leitura da carteira">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <Facto
            rotulo="Renda por captar"
            valor={<Money value={potencialMes} escala="lg" tom={potencialMes > 0 ? "acao" : "tinta-2"} />}
            nota={
              potencialMes > 0
                ? `${fmtEur(potencialMes * 12)} por ano, se tudo fosse à mediana`
                : "nenhuma renda abaixo da mediana"
            }
          />
          <Facto
            rotulo="Abaixo do mercado"
            valor={<Figure value={String(abaixo.length)} escala="lg" tom={abaixo.length > 0 ? "atencao" : "tinta"} />}
            nota={`10% ou mais abaixo, em ${comDesvio.length} com renda e área`}
          />
          <Facto
            rotulo="Yield bruto"
            valor={<Figure value={fmtPct(yieldMedio, 1)} escala="lg" />}
            nota="renda anual sobre o valor estimado"
          />
          <Facto
            rotulo="Sem comparação"
            valor={<Figure value={String(semDados)} escala="lg" tom={semDados > 0 ? "tinta-2" : "tinta"} />}
            nota={semDados > 0 ? "falta área, freguesia, ou não é habitação" : "todas comparadas"}
          />
        </dl>
        <p className="mt-4 max-w-[72ch] text-xs leading-relaxed text-tinta-3">
          As medianas são de <strong className="font-medium text-tinta-2">novos</strong> contratos:
          dizem quanto se cobraria hoje a quem entrasse agora, não o que é legal aumentar a quem já
          cá está (isso segue o coeficiente anual).
          {porConcelho > 0 && (
            <>
              {" "}
              O INE só publica cerca de 330 freguesias e nenhuma é desta carteira:{" "}
              {porConcelho === comparaveis.length
                ? "todas as comparações são"
                : `${porConcelho} comparações são`}{" "}
              contra a mediana do <strong className="font-medium text-tinta-2">concelho</strong>.
            </>
          )}{" "}
          Loja, garagem e arrecadação não entram: as medianas do INE são de alojamentos.
        </p>
      </Seccao>

      <Seccao
        titulo="Fração a fração"
        valor={
          <span className="text-xs text-tinta-3">das mais abaixo do mercado para as mais acima</span>
        }
      >
        <ul className="divide-y divide-regua">
          {linhas.map(({ property, contract, mv }) => (
            <li key={property.id} className="py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <Link
                    href={`/fracoes/${property.id}`}
                    className="text-[15px] font-medium text-tinta transition-colors duration-150 hover:text-acao"
                  >
                    {property.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-tinta-3">
                    {property.parish ?? "freguesia por preencher"}
                    {mv.benchmark?.level === "concelho" && " · mediana do concelho"}
                    {contract ? ` · ${fmtEur(contract.rent)}/mês` : " · sem contrato"}
                  </p>
                </div>

                <div className="flex shrink-0 items-baseline gap-4">
                  {mv.deviation !== null ? (
                    <DeviationBadge deviation={mv.deviation} />
                  ) : (
                    <span className="text-xs text-tinta-3">por comparar</span>
                  )}
                  {mv.gapEurMonth !== null && (
                    <Money value={mv.gapEurMonth} escala="md" tom="acao" sign />
                  )}
                </div>
              </div>

              {/* R3: a aritmética existe sempre, mas não gasta uma linha enquanto ninguém a
                  pede. Quem só quer saber "estou a cobrar pouco?" já leu a badge. */}
              {mv.benchmark !== undefined && (
                <details className="mt-1.5 text-xs">
                  <summary className="inline-flex cursor-pointer select-none text-tinta-3 transition-colors duration-150 hover:text-tinta-2">
                    a conta
                  </summary>
                  <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-tinta-2 sm:grid-cols-4">
                    <Linha
                      rotulo="Área"
                      valor={property.area_m2 ? `${fmtNum(property.area_m2, 1)} m²` : "n/d"}
                    />
                    <Linha
                      rotulo="Renda €/m²"
                      valor={mv.rentPerM2 !== null ? fmtNum(mv.rentPerM2, 2) : "n/d"}
                    />
                    <Linha
                      rotulo="Mediana €/m²"
                      valor={mv.benchmarkRentM2 !== null ? fmtNum(mv.benchmarkRentM2, 2) : "n/d"}
                    />
                    <Linha rotulo="Valor estimado" valor={fmtEur(mv.estimatedValue)} />
                  </dl>
                </details>
              )}
            </li>
          ))}
        </ul>
      </Seccao>
    </div>
  );
}

function Facto({ rotulo, valor, nota }: { rotulo: string; valor: React.ReactNode; nota: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">{rotulo}</dt>
      <dd className="mt-1.5">{valor}</dd>
      <dd className="mt-0.5 text-xs leading-snug text-tinta-3">{nota}</dd>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] text-tinta-3">{rotulo}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}
