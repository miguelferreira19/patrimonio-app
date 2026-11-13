import { Linha, Seccao } from "@/components/kit";
import { fmtDate } from "@/lib/format";
import type { FichaInquilino } from "@/lib/portfolio/inquilinos";
import { nomeDaFracao } from "@/lib/portfolio/predios";

export function FactosInquilino({ ficha, atualizacao, diaHabitual }: {
  ficha: FichaInquilino; atualizacao: string | null; diaHabitual: number | null;
}) {
  const factos = [{ nome: "Contrato desde", valor: ficha.desde ? fmtDate(ficha.desde) : "Sem informação" },
    { nome: "Última atualização", valor: atualizacao ? fmtDate(atualizacao) : "Sem informação" },
    ...(diaHabitual === null ? [] : [{ nome: "Costuma pagar ao dia", valor: new Intl.NumberFormat("pt-PT").format(diaHabitual) }])];
  const fracoes = [...new Map(ficha.contratos.map((c) => [c.property.id, c.property])).values()];
  return <Seccao titulo="Factos">
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">{factos.map((f) => <div key={f.nome} className="rounded-2xl bg-carta p-3">
      <dt className="text-xs text-tinta-2">{f.nome}</dt>
      <dd className="mt-1 font-display text-base font-bold tabular-nums">{f.valor}</dd>
    </div>)}</dl>
    <div className="mt-3 divide-y divide-regua">
      {fracoes.map((p) => <Linha key={p.id} href={`/fracoes/${p.id}`} titulo={nomeDaFracao(p)} />)}
      {ficha.contratos.map(({ contract, property }) => <Linha key={contract.id}
        href={`/arquivo?fracao=${property.id}`}
        titulo="Contrato no arquivo" sub={contract.pf_contract_no ?? nomeDaFracao(property)} />)}
    </div>
    {ficha.porNome && <details className="mt-3 text-sm text-tinta-2">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Detalhes</summary>
      <p>Sem NIF registado, esta ficha agrupa contratos pelo nome e pode juntar homónimos.</p>
    </details>}
  </Seccao>;
}
