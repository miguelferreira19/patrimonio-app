import { Linha, Money, Seccao } from "@/components/kit";
import { Badge } from "@/components/ui";
import { monthLabel } from "@/lib/format";
import type { TarefaDoInicio } from "./tarefas";

export function AFazer({ tarefas, hoje }: { tarefas: TarefaDoInicio[]; hoje: string }) {
  return <Seccao titulo="A fazer">
    {tarefas.length === 0 ? <div className="vazio">Nada por fazer</div> :
      <ul className="stagger divide-y divide-regua">
        {tarefas.map((t) => <li key={t.id}>
          <Linha href={t.href} titulo={<span className="flex items-center gap-2">
            <Badge className="shrink-0">{t.dia === hoje ? "Hoje" : `${Number(t.dia.slice(8, 10))} ${monthLabel(t.dia, false)}`}</Badge>
            <span className="min-w-0 text-sm">{t.titulo}</span>
          </span>} valor={t.valor != null ? <Money value={t.valor} escala="md" /> : undefined}
            etiqueta={t.estimado || t.unidade ? <span className="flex flex-wrap gap-2">
              {t.unidade && <span className="text-xs text-tinta-2">{t.unidade}</span>}
              {t.estimado && <Badge tone="futuro">estimado</Badge>}
            </span> : undefined} />
        </li>)}
      </ul>}
  </Seccao>;
}
