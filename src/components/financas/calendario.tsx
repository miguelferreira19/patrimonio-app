import { Bloco, Lede, Linha, Money, Seccao } from "@/components/kit";
import { Badge, buttonClass, EmptyState } from "@/components/ui";
import { fmtDate, monthLabel, nomeProprio } from "@/lib/format";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { carregarCalendario } from "@/lib/portfolio/financas-load";
import type { PrazoDoAno } from "@/lib/portfolio/agenda";
import { calendarioVisivel, prazosFeitos } from "./modelo";
import EstadoPrazo from "./estado-prazo";

export default async function Calendario({ isAdmin }: { isAdmin: boolean }) {
  const { raw } = await getSnapshotComRaw();
  const { hoje, prazos } = await carregarCalendario(prazosFeitos(raw.insightState));
  const c = calendarioVisivel(prazos, hoje);
  return <div className="space-y-6">
    <Lede title="Calendário" actions={<a href="/api/agenda" className={buttonClass({ variant: "outline" })}>Calendário .ics</a>} />
    <Bloco tom="futuro" rotulo="Próximo prazo" valor={c.proximo ? fmtDate(c.proximo.dia) : "Sem prazos"}
      legenda={c.proximo?.titulo}>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm">Próximos 90 dias</span>
        <Money value={c.valor90Dias} escala="xl" className="text-inherit" />
      </div>
      <span className="text-xs">Valores conhecidos{c.incluiEstimativas ? " · inclui estimativas" : ""}</span>
    </Bloco>
    {c.meses.map(({ mes, prazos: lista }) => <Seccao key={mes} titulo={monthLabel(mes, true)}>
      {lista.length ? <ul className="stagger divide-y divide-regua">{lista.map((p) =>
        <li key={p.id}><Prazo prazo={p} isAdmin={isAdmin} /></li>)}</ul> : <EmptyState>Sem prazos neste mês.</EmptyState>}
    </Seccao>)}
  </div>;
}

function Prazo({ prazo: p, isAdmin }: { prazo: PrazoDoAno; isAdmin: boolean }) {
  return <div className="flex items-start gap-3 py-2">
    <span className="mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-carta text-sm font-semibold tabular-nums">
      {p.dia.slice(8, 10)}
    </span>
    <div className="min-w-0 flex-1">
      <Linha titulo={p.titulo} sub={p.senhorio ? nomeProprio(p.senhorio) : undefined}
        valor={<Money value={p.valor} />} etiqueta={<span className="flex flex-wrap gap-2">
          {p.estimado && <Badge tone="futuro">estimado</Badge>}{p.feito && <Badge tone="confirmado">Feito</Badge>}
        </span>} />
      <div className="flex flex-wrap items-start gap-3">
        {isAdmin && <EstadoPrazo id={p.id} feito={p.feito} />}
        {p.nota && <details className="min-w-0 text-sm text-tinta-2">
          <summary className="inline-flex min-h-11 cursor-pointer items-center">Detalhes</summary>
          <p className="pb-2">{p.nota}</p>
        </details>}
      </div>
    </div>
  </div>;
}
