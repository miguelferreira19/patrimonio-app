// RENTABILIDADE (PLANO_CLAREZA.md, Fases 3 e 4): o que rende, o que custa e o que se pode
// ganhar. Absorve a Análise (Projeção), o Mercado e as Despesas, que ficam em separadores.
//
// Visual, não prosa (pedido do utilizador): caixas, barras por prédio e uma tabela. Os
// números saem de `rentabilidade.ts` (puro, com check) e as oportunidades da MESMA fila do
// Hoje (`insights.ts`), por isso um valor nunca aparece com dois números diferentes.

import Link from "next/link";
import { Confianca, Lede, Money } from "@/components/kit";
import { Badge, cn } from "@/components/ui";
import { getSession } from "@/lib/data";
import { quotasDeclarantes, scopedExpense } from "@/lib/gestao";
import { fmtPct, lastMonthsKeys, monthLabel } from "@/lib/format";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { getReceiptsInPeriod } from "@/lib/portfolio/gestao-load";
import { construirFila, type Insight } from "@/lib/portfolio/insights";
import { rentabilidade, type LinhaRentabilidade, type PredioRentabilidade } from "@/lib/portfolio/rentabilidade";
import Projecao from "@/components/rentabilidade/projecao";
import Despesas from "@/components/rentabilidade/despesas";
import Mercado from "@/components/rentabilidade/mercado";

export const dynamic = "force-dynamic";

/** Abaixo disto, a fração rende pouco face ao que vale (renda líquida de custos ÷ valor). */
const RENDE_POUCO = 0.03;

type Ordem = "resultado" | "renda" | "rendimento" | "vagos";

export default async function Rentabilidade({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ordem?: string; ambito?: string; senhorio?: string }>;
}) {
  const [sp, { isAdmin }] = await Promise.all([searchParams, getSession()]);
  const tabs: Array<[string, string]> = [
    ["resultado", "Resultado"],
    ["mercado", "Mercado"],
    ["despesas", "Despesas"],
    ...(isAdmin ? ([["projecao", "Projeção"]] as Array<[string, string]>) : []),
  ];
  const tab = tabs.some(([k]) => k === sp.tab) ? sp.tab! : "resultado";

  return (
    <div className="space-y-6">
      <nav aria-label="Rentabilidade" className="-mx-4 flex gap-1 overflow-x-auto border-b border-regua px-4 md:mx-0 md:px-0">
        {tabs.map(([k, nome]) => (
          <Link
            key={k}
            href={k === "resultado" ? "/rentabilidade" : `/rentabilidade?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              tab === k ? "border-tinta text-tinta" : "border-transparent text-tinta-3 hover:text-tinta-2",
            )}
          >
            {nome}
          </Link>
        ))}
      </nav>
      {tab === "resultado" && <Resultado ordem={(["renda", "rendimento", "vagos"].includes(sp.ordem ?? "") ? sp.ordem : "resultado") as Ordem} />}
      {tab === "mercado" && <Mercado searchParams={Promise.resolve(sp)} />}
      {tab === "despesas" && <Despesas searchParams={Promise.resolve(sp)} />}
      {tab === "projecao" && <Projecao searchParams={Promise.resolve(sp)} />}
    </div>
  );
}

async function Resultado({ ordem }: { ordem: Ordem }) {
  const { snap, raw } = await getSnapshotComRaw();
  // O último mês que TODAS as fontes conhecem: depois dele a herança não tem recibos.
  const fim = snap.fronteiraComum ?? snap.horizon ?? snap.faixaMeses[snap.faixaMeses.length - 1];
  const meses = lastMonthsKeys(12, fim);
  const recibos = await getReceiptsInPeriod(meses[0], fim);
  const declarantes = quotasDeclarantes(raw.expenses, raw.owners);
  const despesas = raw.expenses.flatMap((e) => {
    if (!e.property_id) return [];
    const v = scopedExpense(e, raw.owners, raw.landlords, "inteiro", undefined, declarantes);
    return v.amount === null ? [] : [{ ...e, amount: v.amount }];
  });
  const r = rentabilidade({
    ativos: snap.correntes.map((a) => ({ property: a.property, contracts: a.contracts, valor: a.mercado.estimatedValue })),
    recibos,
    despesas,
    fim,
  });
  // O que se pode realizar primeiro; o "só na mudança de inquilino" (assumido) vai para o fim.
  const oportunidades = construirFila(snap)
    .itens.filter((i) => i.grupo === "poupar")
    .sort((x, y) => Number(x.confianca === "assumido") - Number(y.confianca === "assumido"));
  const comRenda = r.fracoes.filter((l) => l.renda > 0);
  const ordenadas = [...r.fracoes].sort(ORDENACAO[ordem]);

  return (
    <div className="space-y-8 md:space-y-10">
      <Lede title="Rentabilidade" variant="plain">
        {monthLabel(meses[0])} a {monthLabel(fim)} · imóveis por inteiro
      </Lede>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Caixa rotulo="Renda recebida" valor={<Money value={r.totais.renda} escala="xl" />} />
        <Caixa rotulo="Custos" valor={<Money value={r.totais.custos} escala="xl" tom="atencao" />} />
        <Caixa rotulo="Resultado" valor={<Money value={r.totais.resultado} escala="xl" />} />
        {/* Ponto 10: isto divide uma MEDIÇÃO (renda recebida) por uma ESTIMATIVA (o valor
            de mercado). Vai marcado, como manda o princípio 8 do PLANO_CLAREZA. */}
        <Caixa
          rotulo="% do valor"
          valor={
            <span className="text-2xl font-semibold tabular-nums">
              {r.totais.rendimento === null ? "·" : fmtPct(r.totais.rendimento, 1)}
            </span>
          }
          nota={
            <>
              resultado ÷ valor de mercado{" "}
              <Confianca nivel="estimado" conta="O valor de mercado é estimado; a renda e os custos são medidos." />
            </>
          }
        />
      </div>

      <section>
        <Cabecalho titulo="Por prédio">
          <span className="flex items-center gap-3 text-xs text-tinta-3">
            <i className="inline-block size-2.5 rounded-[3px] bg-tinta" /> resultado
            <i className="inline-block size-2.5 rounded-[3px] bg-atencao" /> custos
          </span>
        </Cabecalho>
        <ul className="divide-y divide-regua overflow-hidden rounded-2xl border border-regua bg-carta">
          {r.predios.map((p) => (
            <BarraDePredio key={p.chave} p={p} maior={Math.max(1, ...r.predios.map((x) => x.renda))} />
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Top titulo="As 5 de maior resultado" linhas={comRenda.slice(0, 5)} />
        <Top titulo="As 5 de menor resultado" linhas={comRenda.slice(-5).reverse()} tom="atencao" />
      </div>

      {oportunidades.length > 0 && (
        <section>
          <Cabecalho titulo="Oportunidades">
            <span className="text-xs text-tinta-3">por ano</span>
          </Cabecalho>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {oportunidades.map((o) => (
              <Oportunidade key={o.kind} o={o} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <Cabecalho titulo="Todas as frações">
          <span className="text-xs text-tinta-3">{r.fracoes.length}</span>
        </Cabecalho>
        <TabelaDeFracoes linhas={ordenadas} ordem={ordem} />
      </section>
    </div>
  );
}

const ORDENACAO: Record<Ordem, (a: LinhaRentabilidade, b: LinhaRentabilidade) => number> = {
  resultado: (a, b) => b.resultado - a.resultado,
  renda: (a, b) => b.renda - a.renda,
  rendimento: (a, b) => (b.rendimento ?? -Infinity) - (a.rendimento ?? -Infinity),
  vagos: (a, b) => b.mesesVagos - a.mesesVagos,
};

function Cabecalho({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-tinta">{titulo}</h2>
      {children}
    </header>
  );
}

function Caixa({ rotulo, valor, nota }: { rotulo: string; valor: React.ReactNode; nota?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-regua bg-carta p-3 sm:p-5">
      <p className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">{rotulo}</p>
      <div className="mt-1.5 sm:mt-2">{valor}</div>
      {nota && <p className="mt-1 text-xs text-tinta-2">{nota}</p>}
    </div>
  );
}

/** A renda do prédio numa barra: o que sobra a tinta, os custos a âmbar. Um prédio que
 *  custa mais do que rende fica com a barra a vermelho. */
function BarraDePredio({ p, maior }: { p: PredioRentabilidade; maior: number }) {
  const largura = (Math.max(p.renda, p.custos) / maior) * 100;
  const parteCustos = p.renda > 0 ? Math.min(100, (p.custos / p.renda) * 100) : 100;
  return (
    <li className="px-4 py-3 md:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link href={`/imoveis/${encodeURIComponent(p.chave)}`} className="min-w-0 truncate text-[15px] font-semibold text-tinta hover:text-acao">
          {p.nome}
        </Link>
        <span className="flex items-baseline gap-2">
          {p.mesesVagos > 0 && <Badge tone="atencao">{p.mesesVagos} m vago</Badge>}
          <Money value={p.resultado} escala="lg" tom={p.resultado < 0 ? "perda" : "tinta"} />
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-vellum" aria-hidden="true">
        <div className="flex h-full" style={{ width: `${Math.max(2, largura)}%` }}>
          {p.resultado >= 0 ? (
            <>
              <span className="h-full bg-tinta" style={{ width: `${100 - parteCustos}%` }} />
              <span className="h-full bg-atencao" style={{ width: `${parteCustos}%` }} />
            </>
          ) : (
            <span className="h-full w-full bg-perda" />
          )}
        </div>
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-tinta-3">
        renda <Money value={p.renda} escala="sm" tom="tinta-2" /> · custos <Money value={p.custos} escala="sm" tom="tinta-2" />
        {p.rendimento !== null && ` · ${fmtPct(p.rendimento, 1)} do valor`}
      </p>
    </li>
  );
}

function Top({ titulo, linhas, tom = "tinta" }: { titulo: string; linhas: LinhaRentabilidade[]; tom?: "tinta" | "atencao" }) {
  return (
    <section className="rounded-2xl border border-regua bg-carta p-4 md:p-5">
      <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>
      <ol className="mt-2 divide-y divide-regua">
        {linhas.map((l) => (
          <li key={l.property.id} className="flex items-baseline justify-between gap-3 py-2.5">
            <Link href={`/fracoes/${l.property.id}`} className="min-w-0 truncate text-sm text-tinta hover:text-acao">
              {l.nome}
            </Link>
            <span className="shrink-0">
              <Money value={l.resultado} escala="md" tom={l.resultado < 0 ? "perda" : tom} />
              <span className="text-xs text-tinta-3">/ano</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const CONFIANCA: Record<Insight["confianca"], { tom: "confirmado" | "neutro" | "futuro"; texto: string }> = {
  medido: { tom: "confirmado", texto: "medido" },
  estimado: { tom: "neutro", texto: "estimado" },
  assumido: { tom: "futuro", texto: "só na mudança de inquilino" },
};

function Oportunidade({ o }: { o: Insight }) {
  const c = CONFIANCA[o.confianca];
  const acao = o.acoes[0];
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-regua bg-carta p-4">
      <div className="flex items-start justify-between gap-2">
        <Money value={o.euros} escala="xl" tom={o.confianca === "assumido" ? "futuro" : "acao"} />
        <Badge tone={c.tom}>{c.texto}</Badge>
      </div>
      <p className="text-sm font-medium leading-snug text-tinta">{o.titulo}</p>
      {acao && (
        <Link href={acao.href} className="mt-auto text-sm font-medium text-acao hover:underline">
          {acao.label}
        </Link>
      )}
    </li>
  );
}

function TabelaDeFracoes({ linhas, ordem }: { linhas: LinhaRentabilidade[]; ordem: Ordem }) {
  const coluna = (o: Ordem, nome: string) => (
    <Link
      href={o === "resultado" ? "/rentabilidade" : `/rentabilidade?ordem=${o}`}
      aria-current={ordem === o ? "true" : undefined}
      className={cn("hover:text-tinta", ordem === o && "font-semibold text-tinta")}
    >
      {nome}
      {ordem === o ? " ↓" : ""}
    </Link>
  );
  return (
    <div className="overflow-x-auto rounded-2xl border border-regua bg-carta">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-vellum text-xs text-tinta-2">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Fração</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{coluna("renda", "Renda")}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Custos</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{coluna("resultado", "Resultado")}</th>
            <th scope="col" className="px-4 py-3 font-medium">Meses pagos</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{coluna("vagos", "Vago")}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{coluna("rendimento", "% do valor")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-regua">
          {linhas.map((l) => (
            <tr key={l.property.id} className="hover:bg-vellum/50">
              <th scope="row" className="max-w-[240px] truncate px-4 py-3 font-medium">
                <Link href={`/fracoes/${l.property.id}`} className="text-tinta hover:text-acao">{l.nome}</Link>
              </th>
              <td className="px-4 py-3 text-right"><Money value={l.renda} /></td>
              <td className="px-4 py-3 text-right"><Money value={l.custos} tom={l.custos > 0 ? "atencao" : "tinta-2"} /></td>
              <td className="px-4 py-3 text-right"><Money value={l.resultado} tom={l.resultado < 0 ? "perda" : "tinta"} /></td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-vellum" aria-hidden="true">
                    <span className={cn("block h-full", l.mesesPagos < 12 - l.mesesVagos ? "bg-atencao" : "bg-tinta")} style={{ width: `${(l.mesesPagos / 12) * 100}%` }} />
                  </span>
                  <span className="text-xs tabular-nums text-tinta-2">{l.mesesPagos}/12</span>
                </span>
              </td>
              <td className="px-4 py-3 text-right text-xs tabular-nums">{l.mesesVagos > 0 ? <Badge tone="atencao">{l.mesesVagos} m</Badge> : "·"}</td>
              <td className="px-4 py-3 text-right text-xs tabular-nums">
                {l.rendimento === null ? (
                  <span className="text-tinta-3">·</span>
                ) : l.rendimento < RENDE_POUCO ? (
                  <Badge tone="atencao">{fmtPct(l.rendimento, 1)}</Badge>
                ) : (
                  fmtPct(l.rendimento, 1)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
