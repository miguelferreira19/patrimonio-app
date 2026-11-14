import { Bloco, Figure, Lede, Linha, Money, Pilulas, Seccao } from "@/components/kit";
import { Badge, EmptyState } from "@/components/ui";
import { JANELA_DO_CONTROLO_MESES } from "@/lib/controlo";
import { fmtDate, monthLabel, nomeProprio } from "@/lib/format";
import type { carregarControlo } from "./carregar";
import { FILTROS, ligacaoDoContrato, listaDeSinais } from "./modelo";
import { Contas, PorInquilino } from "./emissao";
import EstadoSinal from "./estado-sinal";

export default function Painel({ dados, ver }: {
  dados: Awaited<ReturnType<typeof carregarControlo>>; ver?: string;
}) {
  const lista = listaDeSinais(dados.sinais, dados.estados, ver ?? "por_ver");
  const n = lista.contagens.por_ver;
  return <div className="mx-auto w-full max-w-2xl space-y-6 tabular-nums">
    <Lede title="Controlo">Últimos {JANELA_DO_CONTROLO_MESES} meses</Lede>
    <Bloco tom={n > 0 ? "perda" : "tinta"} tamanho="heroi"
      rotulo={n > 0 ? `${n} sinais por ver` : "Nada por ver"} valor={n} />
    <Contas emissao={dados.emissao} />
    <Pilulas ativo={lista.ativo} itens={FILTROS.map((f) => ({ ...f,
      n: lista.contagens[f.id], href: `/controlo?ver=${f.id}` }))} />
    <Seccao titulo={FILTROS.find((f) => f.id === lista.ativo)!.rotulo}>
      {lista.visiveis.length ? <ul className="stagger divide-y divide-regua">{lista.visiveis.map((s) => {
        const tom = s.gravidade === 3 ? "perda" : "tinta";
        return <li key={s.id}>
          <Linha href={ligacaoDoContrato(s.contrato, dados.contratos)} titulo={nomeProprio(s.inquilino) || `Contrato ${s.contrato}`}
            sub={s.texto} tom={tom} valor={s.valor !== undefined ? <Money value={s.valor} tom={tom} /> :
              s.dias !== undefined ? <Figure value={s.dias} unit="dias" tom={tom} /> : undefined}
            etiqueta={<span className="flex flex-wrap items-center gap-2">
              <time dateTime={s.dia}>{s.dia.length === 7 ? monthLabel(`${s.dia}-01`, true) : fmtDate(s.dia)}</time>
              {lista.estados.has(s.id) && <Badge tone="confirmado">{lista.estados.get(s.id)}</Badge>}
            </span>} />
          <EstadoSinal id={s.id} estado={lista.estados.get(s.id)} />
        </li>;
      })}</ul> : <EmptyState>Nenhum sinal nesta lista.</EmptyState>}
    </Seccao>
    <PorInquilino emissao={dados.emissao} contratos={dados.contratos} />
  </div>;
}
