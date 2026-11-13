import { Linha, Money, Seccao } from "@/components/kit";
import type { Problema } from "@/lib/portfolio/problemas";

export function ListaProblemas({ itens }: { itens: Array<{ problema: Problema; fracao?: string }> }) {
  if (itens.length === 0) return null;
  return <Seccao titulo="Problemas">
    <ul className="stagger divide-y divide-regua rounded-[20px] bg-carta px-4">
      {itens.map(({ problema: p, fracao }, i) => <li key={`${p.tipo}-${i}`}>
        <Linha href={p.href} titulo={p.texto} sub={fracao} tom={p.gravidade === 3 ? "perda" : "tinta"}
          etiqueta={p.gravidade === 3 ? "Grave" : "A ver"}
          valor={p.valor !== undefined ? <Money value={p.valor} escala="lg" tom={p.gravidade === 3 ? "perda" : "tinta"} /> : undefined} />
      </li>)}
    </ul>
  </Seccao>;
}
