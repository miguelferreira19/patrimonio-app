import { Bloco, Lede, Linha, Money, Seccao } from "@/components/kit";
import { Badge, EmptyState } from "@/components/ui";
import { fmtPct, nomeProprio } from "@/lib/format";
import { carregarPoupanca } from "@/lib/portfolio/financas-load";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/types";

export default async function Poupanca() {
  const d = await carregarPoupanca();
  const nomes = new Map(d.propriedades.map((p) => [p.id, nomeDaFracao(p)]));
  const semPrazo = new Set(d.linhas.filter((l) => l.falta === "registar o prazo do contrato")
    .map((l) => l.contratoId)).size;
  const linhas = d.linhas.filter((l) => l.falta !== "registar o prazo do contrato" &&
    l.falta !== "prazo inferior a 5 anos" && (l.eurosPorAno > 0 || l.falta === null));
  return <div className="space-y-6">
    <Lede title="Poupança" />
    <div className="grid gap-3 sm:grid-cols-2">
      <Bloco tom="tinta" rotulo="Pode poupar por ano"
        valor={<Money value={d.resumo.realizavel} escala="xl" className="text-inherit" />} />
      <Bloco tom="neutro" rotulo="Por confirmar"
        valor={<Money value={d.resumo.porConfirmar} escala="xl" />}
        legenda="depende do prazo do contrato" />
    </div>
    <Seccao titulo="Taxa reduzida (art. 72.º)" valor={<span className="text-sm tabular-nums">{d.ano}</span>}>
      {linhas.length > 0 || semPrazo > 0 ? <ul className="stagger divide-y divide-regua">{linhas.map((l) =>
        <li key={`${l.contratoId}:${l.senhorio}`}><Linha href={`/fracoes/${l.propertyId}`}
          titulo={nomes.get(l.propertyId) ?? "Fração"}
          sub={`${nomeProprio(l.senhorio)} · ${fmtPct(l.taxaAtual, 0)} → ${fmtPct(l.taxaPossivel, 0)}`}
          valor={<span><Money value={l.eurosPorAno} /><span className="text-xs">/ano</span></span>}
          etiqueta={l.falta ? <Badge tone="futuro">{l.falta}</Badge> : undefined} /></li>)}
        {semPrazo > 0 && <li><Linha href="/contratos" titulo={`${semPrazo} ${semPrazo === 1 ? "contrato sem prazo registado" : "contratos sem prazo registado"}`}
          sub="sem prazo não há taxa reduzida" /></li>}</ul> :
        <EmptyState>Sem poupança por realizar</EmptyState>}
    </Seccao>
    <Seccao titulo="Despesas por lançar" valor={<span className="text-sm tabular-nums">{d.ano}</span>}>
      {d.despesas.length ? <ul className="divide-y divide-regua">{d.despesas.map((l) =>
        <li key={`${l.propertyId}:${l.categoria}`}><Linha href={`/fracoes/${l.propertyId}`}
          titulo={nomes.get(l.propertyId) ?? "Fração"}
          sub={`${EXPENSE_CATEGORY_LABEL[l.categoria as keyof typeof EXPENSE_CATEGORY_LABEL] ?? l.categoria} · ${d.ano - 1}`}
          valor={<Money value={l.valorAnterior} />} etiqueta="Valor do ano anterior" /></li>)}</ul> :
        <EmptyState>Sem despesas por lançar identificadas.</EmptyState>}
    </Seccao>
    <Seccao titulo="Englobamento ou taxa autónoma" valor={<Badge tone="futuro">estimado</Badge>}>
      {d.porSenhorio.length ? <ul className="divide-y divide-regua">{d.porSenhorio.map(({ landlord, fy }) =>
        <li key={landlord.id}><Linha href={`/financas?tab=impostos&ano=${d.ano}&senhorio=${landlord.id}`}
          titulo={nomeProprio(landlord.name)} sub={fy.bestRegime === "autonoma" ? "Taxa autónoma" : "Englobamento"}
          valor={<Money value={Math.abs(fy.autonomousTax - fy.englobedTax)} />} etiqueta="Diferença de imposto" /></li>)}</ul> :
        <EmptyState>Sem senhorios registados.</EmptyState>}
    </Seccao>
  </div>;
}
