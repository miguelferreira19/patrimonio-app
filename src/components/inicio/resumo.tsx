import { Barra, Bloco, Linha, Money, Seccao } from "@/components/kit";
import { monthLabel, nomeProprio } from "@/lib/format";
import { devedores } from "@/lib/portfolio/inquilinos";
import { emAtrasoDaCarteira, fontesParadas } from "@/lib/portfolio/insights";
import { resumoDoMes } from "@/lib/portfolio/rendas";
import type { Snapshot } from "@/lib/portfolio/snapshot";

const MOEDA_HERDADA = "text-inherit text-[length:inherit] md:text-[length:inherit] font-[number:inherit]";

export function ResumoInicio({ snap }: { snap: Snapshot }) {
  const mes = resumoDoMes(snap);
  const total = emAtrasoDaCarteira(snap).reduce((soma, linha) => soma + linha.debt, 0);
  const porReceber = mes.total - mes.pagas;
  return <div className="space-y-3">
    <div className="destaque">
      <Bloco tom={total > 0 ? "perda" : "tinta"} tamanho="heroi"
        rotulo={total > 0 ? `${mes.inquilinosEmAtraso} ${mes.inquilinosEmAtraso === 1 ? "inquilino em atraso" : "inquilinos em atraso"}` : "Tudo em dia"}
        valor={<Money value={total > 0 ? total : mes.recebido} escala="hero" className={MOEDA_HERDADA} />}
        legenda={total > 0 ? undefined : "Recebido este mês"}
        href={total > 0 ? "/rendas?estado=em_atraso" : undefined}
        acao={total > 0 ? "Ver quem deve" : undefined} />
    </div>
    <div className="grid grid-cols-2 gap-2.5">
      <Bloco tom="tinta" rotulo={mes.pagas === 1 ? "paga este mês" : "pagas este mês"} valor={mes.pagas}
        legenda={<Money value={mes.recebido} className="text-inherit" />} href="/rendas?estado=paga" />
      <Bloco tom="futuro" rotulo="por receber" valor={porReceber}
        legenda={<Money value={mes.porReceber} tom="futuro" />} href="/rendas?estado=por_receber" />
    </div>
  </div>;
}

export function QuemDeve({ snap }: { snap: Snapshot }) {
  const lista = devedores(snap);
  if (lista.length === 0) return null;
  return <Seccao titulo="Quem deve">
    <ul className="stagger divide-y divide-regua">
      {lista.slice(0, 3).map((d) => {
        const meses = Math.max(...d.contratos.map((c) => c.meses));
        return <li key={d.chave}>
          <Linha href={`/inquilinos/${encodeURIComponent(d.chave)}`} titulo={nomeProprio(d.nome)} tom="perda"
            valor={<Money value={d.divida} escala="lg" tom="perda" />}>
            <div className="flex items-center gap-3">
              <Barra parte={d.divida} total={lista[0].divida} tom="perda" />
              <span className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-perda">
                {meses} {meses === 1 ? "mês" : "meses"}
              </span>
            </div>
          </Linha>
        </li>;
      })}
    </ul>
    {lista.length > 3 && <Linha href="/rendas?estado=em_atraso" titulo={`Ver os ${lista.length}`} />}
  </Seccao>;
}

export function SemInformacao({ snap }: { snap: Snapshot }) {
  const n = resumoDoMes(snap).semInformacao;
  if (n === 0) return null;
  const fontes = fontesParadas(snap);
  return <Bloco tom="neutro" rotulo="Sem informação" valor={n}
    legenda={n === 1 ? "contrato" : "contratos"} href="/rendas?estado=sem_informacao">
    {fontes.map((f) => <span key={f.landlord.id} className="mt-2 text-sm text-tinta-2">
      {nomeProprio(f.landlord.name) === "Miguel" ? "Herança do avô" : nomeProprio(f.landlord.name)}
      {` · desde ${monthLabel(f.horizonte)}`}
    </span>)}
  </Bloco>;
}
