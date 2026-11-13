import { Linha, Money } from "@/components/kit";
import { Badge } from "@/components/ui";
import type { ResumoPredio } from "@/lib/portfolio/imoveis";
import { contarPorGravidade, type Problema } from "@/lib/portfolio/problemas";

export function destinoDoPredio(p: ResumoPredio): string {
  return `/imoveis/${encodeURIComponent(p.chave)}`;
}

export function CartaoPredio({ p, back, scopeLabel, problemas = [] }: {
  p: ResumoPredio; back?: string; scopeLabel?: string; problemas?: Problema[];
}) {
  const { g3, g2, g1 } = contarPorGravidade(problemas);
  return <div className="rounded-[20px] bg-carta px-4 py-2">
    <Linha href={destinoDoPredio(p) + (back ? `?voltar=${encodeURIComponent(back)}` : "")}
      titulo={p.nome} sub={`${p.fracoes.length} ${p.fracoes.length === 1 ? "fração" : "frações"}${scopeLabel ? ` · ${scopeLabel}` : ""}`}
      valor={<Money value={p.renda} escala="lg" />}>
      {problemas.length > 0 && <div className="flex flex-wrap gap-2">
        {g3 > 0 && <Badge tone="perda">{g3} {g3 === 1 ? "grave" : "graves"}</Badge>}
        {g2 > 0 && <Badge tone="neutro">{g2} a ver</Badge>}
        {g1 > 0 && <Badge tone="neutro">{g1} a acompanhar</Badge>}
      </div>}
      {problemas.length > 0 && <ul className="space-y-1 text-sm text-tinta-2">
        {problemas.slice(0, 2).map((p, i) => <li key={`${p.tipo}-${i}`}>{p.texto}</li>)}
      </ul>}
    </Linha>
  </div>;
}
