import { Bloco, Figure, Linha, Money, Seccao } from "@/components/kit";
import { Badge } from "@/components/ui";
import { quotasDeclarantes, scopedExpense } from "@/lib/gestao";
import { fmtPct, lastMonthsKeys, monthLabel } from "@/lib/format";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { getReceiptsInPeriod } from "@/lib/portfolio/gestao-load";
import { construirFila, type Insight } from "@/lib/portfolio/insights";
import { rentabilidade } from "@/lib/portfolio/rentabilidade";
import { ORDENACAO, PorPredio, TabelaDeFracoes, Top, type Ordem } from "./resultado-listas";

async function carregarResultado() {
  const { snap, raw } = await getSnapshotComRaw();
  const fim = snap.fronteiraComum ?? snap.horizon ?? snap.faixaMeses.at(-1)!;
  const meses = lastMonthsKeys(12, fim);
  const recibos = await getReceiptsInPeriod(meses[0], fim);
  const declarantes = quotasDeclarantes(raw.expenses, raw.owners);
  const despesas = raw.expenses.flatMap((e) => {
    if (!e.property_id) return [];
    const v = scopedExpense(e, raw.owners, raw.landlords, "inteiro", undefined, declarantes);
    return v.amount === null ? [] : [{ ...e, amount: v.amount }];
  });
  return { meses, fim, oportunidades: construirFila(snap).itens.filter((i) => i.grupo === "poupar")
    .sort((a, b) => Number(a.confianca === "assumido") - Number(b.confianca === "assumido")),
    r: rentabilidade({ ativos: snap.correntes.map((a) => ({ property: a.property,
      contracts: a.contracts, valor: a.mercado.estimatedValue })), recibos, despesas, fim }) };
}

export default async function Resultado({ ordem: pedida }: { ordem?: string }) {
  const ordem: Ordem = pedida && Object.hasOwn(ORDENACAO, pedida) ? pedida as Ordem : "resultado";
  const { r, meses, fim, oportunidades } = await carregarResultado();
  const comRenda = r.fracoes.filter((l) => l.renda > 0);
  const maior = Math.max(1, ...comRenda.map((l) => l.renda));
  return <div className="space-y-6">
    <Bloco tom="tinta" tamanho="heroi" rotulo="Resultado dos últimos 12 meses"
      valor={<Money value={r.totais.resultado} escala="hero" className="text-inherit text-[length:inherit] md:text-[length:inherit]" />}
      legenda={`${monthLabel(meses[0])} a ${monthLabel(fim)}`}>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span>Renda <Money value={r.totais.renda} className="text-inherit" /></span>
        <span>Custos <Money value={r.totais.custos} className="text-inherit" /></span>
        {r.totais.renda > 0 && <span>Custos / renda <Figure value={fmtPct(r.totais.custos / r.totais.renda, 0)} className="text-inherit" /></span>}
      </div>
    </Bloco>
    <Bloco tom="neutro" rotulo="% do valor"
      valor={<Figure value={r.totais.rendimento === null ? "Sem informação" : fmtPct(r.totais.rendimento, 1)} escala="xl" />}
      legenda="renda ÷ valor de mercado estimado" />
    <details className="text-sm text-tinta-2"><summary className="inline-flex min-h-11 cursor-pointer items-center">Detalhes</summary>
      <p>Valores por inteiro. Os custos só são de confiar no total da carteira: uma despesa nem sempre é lançada na fração onde foi feita. A percentagem do valor usa só a renda e um valor de mercado estimado.</p>
    </details>
    <PorPredio predios={r.predios} />
    <Top titulo="As 5 de maior renda" linhas={comRenda.slice(0, 5)} maximo={maior} />
    <Top titulo="As 5 de menor renda" linhas={comRenda.slice(-5).reverse()} maximo={maior} />
    {oportunidades.length > 0 && <Oportunidades itens={oportunidades} />}
    <TabelaDeFracoes linhas={[...r.fracoes].sort(ORDENACAO[ordem])} ordem={ordem} />
  </div>;
}

function Oportunidades({ itens }: { itens: Insight[] }) {
  return <Seccao titulo="Oportunidades" valor={<span className="text-xs">por ano</span>}>
    <ul className="divide-y divide-regua">{itens.map((o) => <li key={`${o.kind}:${o.subject ?? ""}`}>
      <Linha titulo={o.titulo} href={o.acoes[0]?.href} valor={<Money value={o.euros} />}
        etiqueta={<Badge tone={o.confianca === "assumido" ? "futuro" : "neutro"}>
          {o.confianca === "assumido" ? "só na mudança de inquilino" : o.confianca}</Badge>} />
    </li>)}</ul>
  </Seccao>;
}
