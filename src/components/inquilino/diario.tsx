import { Money, Seccao } from "@/components/kit";
import { nomeProprio } from "@/lib/format";
import type { EventoDoDiario } from "@/lib/portfolio/diario";

function Registos({ eventos }: { eventos: EventoDoDiario[] }) {
  return <ol className="stagger space-y-4">{eventos.map((e) => <li key={`${e.tipo}:${e.id}`} className="flex gap-3">
    <time dateTime={e.dia} className="w-14 shrink-0 pt-0.5 text-xs font-semibold tabular-nums">
      {new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", timeZone: "UTC" })
        .format(new Date(`${e.dia}T00:00:00Z`))}
    </time>
    <div className="min-w-0 flex-1">
      <div className="break-words text-base">{e.texto}{e.valor != null && <> · <Money value={e.valor} decimals={2} /></>}</div>
      <div className="mt-0.5 text-xs text-tinta-2">
        {e.tipo === "recibo" ? "Portal das Finanças" : e.autor ? nomeProprio(e.autor) : "Autor não registado"}
      </div>
    </div>
  </li>)}</ol>;
}

export function DiarioInquilino({ eventos }: { eventos: EventoDoDiario[] }) {
  return <Seccao titulo="Diário">
    {eventos.length ? <Registos eventos={eventos.slice(0, 10)} /> :
      <div className="vazio rounded-2xl bg-carta p-5 text-sm text-tinta-2">Sem registos</div>}
    {eventos.length > 10 && <details className="mt-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Ver tudo</summary>
      <Registos eventos={eventos.slice(10)} />
    </details>}
  </Seccao>;
}
