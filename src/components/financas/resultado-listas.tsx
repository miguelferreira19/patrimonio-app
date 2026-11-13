import Link from "next/link";
import { Barra, Linha, Money, Seccao } from "@/components/kit";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui";
import { fmtPct } from "@/lib/format";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import type { LinhaRentabilidade, PredioRentabilidade } from "@/lib/portfolio/rentabilidade";

export type Ordem = "resultado" | "renda" | "rendimento" | "vagos";
export const ORDENACAO: Record<Ordem, (a: LinhaRentabilidade, b: LinhaRentabilidade) => number> = {
  resultado: (a, b) => b.resultado - a.resultado, renda: (a, b) => b.renda - a.renda,
  rendimento: (a, b) => (b.rendimento ?? -Infinity) - (a.rendimento ?? -Infinity),
  vagos: (a, b) => b.mesesVagos - a.mesesVagos,
};

export function PorPredio({ predios }: { predios: PredioRentabilidade[] }) {
  const maior = Math.max(1, ...predios.map((p) => Math.max(p.renda, p.custos)));
  return <Seccao titulo="Por prédio">
    {predios.length ? <ul className="stagger divide-y divide-regua">{predios.map((p) => <li key={p.chave}>
      <Linha href={`/imoveis/${encodeURIComponent(p.chave)}`} titulo={p.nome}
        valor={<Money value={p.resultado} tom={p.resultado < 0 ? "perda" : "tinta"} />}
        etiqueta={p.mesesVagos > 0 ? <Badge tone="futuro">{p.mesesVagos} meses vago</Badge> : undefined}>
        <div className="space-y-1"><span className="text-xs text-tinta-2">Resultado</span>
          <Barra parte={Math.abs(p.resultado)} total={maior} tom={p.resultado < 0 ? "perda" : "tinta"} /></div>
        <div className="space-y-1"><span className="text-xs text-tinta-2">Custos</span>
          <Barra parte={p.custos} total={maior} tom="perda" /></div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-2">
          <span>Renda <Money value={p.renda} escala="sm" /></span>
          <span>Custos <Money value={p.custos} escala="sm" /></span>
          {p.rendimento !== null && <span>{fmtPct(p.rendimento, 1)} do valor</span>}
        </div>
      </Linha>
    </li>)}</ul> : <EmptyState>Sem prédios neste período.</EmptyState>}
  </Seccao>;
}

export function Top({ titulo, linhas, maximo }: { titulo: string; linhas: LinhaRentabilidade[]; maximo: number }) {
  return <Seccao titulo={titulo}>
    {linhas.length ? <ol className="divide-y divide-regua">{linhas.map((l) => <li key={l.property.id}>
      <Linha href={`/fracoes/${l.property.id}`} titulo={nomeDaFracao(l.property)}
        valor={<span><Money value={l.renda} /><span className="text-xs">/ano</span></span>}>
        <Barra parte={l.renda} total={maximo} tom="tinta" />
      </Linha>
    </li>)}</ol> : <EmptyState>Sem rendas neste período.</EmptyState>}
  </Seccao>;
}

function Colunas({ ordem }: { ordem: Ordem }) {
  const opcoes: Array<[Ordem, string]> = [["renda", "Renda"], ["resultado", "Resultado"], ["vagos", "Vago"], ["rendimento", "% do valor"]];
  return <thead><tr><Th>Fração</Th>{opcoes.map(([id, nome]) => <Th key={id} className="text-right">
    <Link href={`/financas?ordem=${id}`} aria-current={ordem === id ? "true" : undefined}
      className="inline-flex min-h-11 items-center">{nome}{ordem === id ? " ↓" : ""}</Link>
  </Th>)}<Th className="text-right">Custos</Th><Th>Meses pagos</Th></tr></thead>;
}

export function TabelaDeFracoes({ linhas, ordem }: { linhas: LinhaRentabilidade[]; ordem: Ordem }) {
  return <Seccao titulo="Todas as frações" valor={<span className="text-sm">{linhas.length}</span>}>
    {linhas.length ? <div className="max-w-full overflow-x-auto"><Table>
      <Colunas ordem={ordem} />
      <tbody>{linhas.map((l) => <tr key={l.property.id}>
        <Td><Link href={`/fracoes/${l.property.id}`} className="inline-flex min-h-11 items-center">{nomeDaFracao(l.property)}</Link></Td>
        <Td className="text-right"><Money value={l.renda} /></Td>
        <Td className="text-right"><Money value={l.resultado} tom={l.resultado < 0 ? "perda" : "tinta"} /></Td>
        <Td className="text-right tabular-nums">{l.mesesVagos}</Td>
        <Td className="text-right tabular-nums">{l.rendimento === null ? "Sem informação" : fmtPct(l.rendimento, 1)}</Td>
        <Td className="text-right"><Money value={l.custos} /></Td>
        <Td><div className="min-w-16"><Barra parte={l.mesesPagos} total={12} tom="tinta" />
          <span className="text-xs tabular-nums">{l.mesesPagos}/12</span></div></Td>
      </tr>)}</tbody>
    </Table></div> : <EmptyState>Sem frações neste período.</EmptyState>}
  </Seccao>;
}
