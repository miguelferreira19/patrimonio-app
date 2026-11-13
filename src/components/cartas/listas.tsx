import { Linha, Money, Seccao } from "@/components/kit";
import { fmtDate, nomeProprio } from "@/lib/format";
import { MINUTAS, enquadrarMinutas, passoDaEscada } from "@/lib/minutas";
import { cartasDoCiclo } from "@/components/cartas";
import type { EventoDoDiario } from "@/lib/portfolio/diario";
import { devedores } from "@/lib/portfolio/inquilinos";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import type { Ativo, Snapshot } from "@/lib/portfolio/snapshot";

export function ListaCobranca({ snap, diario }: { snap: Snapshot; diario: EventoDoDiario[] }) {
  const lista = devedores(snap);
  return <Seccao titulo="Cobrança">
    {lista.length === 0 ? <div className="vazio rounded-2xl bg-carta p-5 text-sm">Tudo em dia</div> :
      <div className="stagger divide-y divide-regua">{lista.flatMap((d) => d.contratos.map((c) => {
        const cartas = cartasDoCiclo(diario, c.contract.id, c.desde, snap.hoje);
        const passo = passoDaEscada({ mesesEmAtraso: c.meses, cartas, hoje: snap.hoje });
        return <Linha key={c.contract.id} href={passo.proxima ? `/cartas/${passo.proxima}/${c.contract.id}` :
          `/inquilinos/${encodeURIComponent(d.chave)}`} titulo={nomeProprio(d.nome)}
          sub={nomeDaFracao(c.property)} tom="perda" valor={<Money value={c.divida} tom="perda" />}
          etiqueta={passo.proxima ? MINUTAS[passo.proxima].label : "Resolução enviada"}>
          <div className="text-xs text-tinta-2 tabular-nums">
            {passo.quando ? `A partir de ${fmtDate(passo.quando)}` : passo.motivo}
          </div>
        </Linha>;
      }))}</div>}
  </Seccao>;
}

function cartasDoContrato(a: Ativo, snap: Snapshot, temCoeficiente: boolean) {
  const c = a.activeContract!;
  const enquadramento = enquadrarMinutas({
    hoje: snap.hoje, temContratoAtivo: true, inicioContrato: c.start_date,
    rendaElegivel: a.rendaAtualizavel?.eligible ?? false,
    rendaElegivelDesde: a.rendaAtualizavel?.eligibleSince ?? null,
    temCoeficiente, mesesEmAtraso: 0,
  });
  const renda = enquadramento.find((m) => m.chave === "renda");
  return [
    ...(renda?.bloqueio === null ? [{ chave: "renda", label: renda.label, href: `/carta/${c.id}` }] : []),
    ...(c.expected_end_date || c.end_date ? [{ chave: "oposicao", label: MINUTAS.oposicao.label,
      href: `/cartas/oposicao/${c.id}` }] : []),
  ];
}

export function ListaRendaContrato({ snap, temCoeficiente }: { snap: Snapshot; temCoeficiente: boolean }) {
  const lista = snap.correntes.filter((a) => a.activeContract).flatMap((a) =>
    cartasDoContrato(a, snap, temCoeficiente).map((carta) => ({ ...carta, ativo: a })));
  return <Seccao titulo="Renda e contrato">
    {lista.length === 0 ? <div className="vazio rounded-2xl bg-carta p-5 text-sm text-tinta-2">Sem cartas disponíveis</div> :
      <div className="stagger divide-y divide-regua">{lista.map(({ chave, label, href, ativo }) =>
        <Linha key={`${chave}:${ativo.activeContract!.id}`} href={href} titulo={label}
          sub={`${nomeProprio(ativo.activeContract!.tenant_name)} · ${nomeDaFracao(ativo.property)}`} />)}</div>}
  </Seccao>;
}
