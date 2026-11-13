import { Money, Seccao } from "@/components/kit";
import { monthLabel, nomeProprio } from "@/lib/format";
import type { EventoDoDiario } from "@/lib/portfolio/diario";

function Registos({ eventos, hoje }: { eventos: EventoDoDiario[]; hoje: string }) {
  return <ol className="stagger space-y-4">{eventos.map((e) => <li key={`${e.tipo}:${e.id}`} className="flex gap-3">
    <time dateTime={e.dia} className="w-20 shrink-0 pt-0.5 text-xs font-semibold tabular-nums">
      {`${Number(e.dia.slice(8, 10))} ${monthLabel(e.dia, e.dia.slice(0, 4) !== hoje.slice(0, 4))}`}
    </time>
    <div className="min-w-0 flex-1">
      <div className="break-words text-base">{e.texto}{e.valor != null && <> · <Money value={e.valor} decimals={2} /></>}</div>
      <div className="mt-0.5 text-xs text-tinta-2">
        {e.tipo === "recibo" ? "Portal das Finanças" : e.autor ? nomeProprio(e.autor) : "Autor não registado"}
      </div>
    </div>
  </li>)}</ol>;
}

export function DiarioInquilino({ eventos, hoje }: { eventos: EventoDoDiario[]; hoje: string }) {
  return <Seccao titulo="Diário">
    {eventos.length ? <Registos eventos={eventos.slice(0, 10)} hoje={hoje} /> :
      <div className="vazio rounded-2xl bg-carta p-5 text-sm text-tinta-2">Sem registos</div>}
    {eventos.length > 10 && <details className="mt-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Ver tudo</summary>
      <Registos eventos={eventos.slice(10)} hoje={hoje} />
    </details>}
  </Seccao>;
}
