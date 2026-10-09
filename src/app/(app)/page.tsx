// HOJE (V4, REDESENHO.md §4.1, 2026-10-09). Substitui o "Agora" da V2/V3.
//
// A pergunta de quem abre a app é "está tudo pago? o que tenho de fazer?", e era isso que
// a página não respondia primeiro: abria com "12 259 € a ganhar com as decisões", um
// número de estratégia, e despejava 8 blocos com o mesmo peso. Agora a ordem é:
//   1. a frase do mês e o cartão do mês em curso (mes.ts: a ÚNICA manchete);
//   2. os últimos 12 meses FECHADOS (o mês em curso já está no cartão; desenhá-lo no
//      gráfico era o "colapso" de outubro no dia 9);
//   3. "Para fazer": a fila do insights.ts em cartões de tarefa, com a lista longa (os
//      recibos por emitir) numa folha lateral em vez de na página;
//   4. os prazos (agenda.ts);
//   5. as oportunidades em duas linhas, porque a estratégia vive em Dinheiro.
//
// As duas leituras continuam separadas: `Tarefas` para o admin, `Atrasados` para o viewer.

import Link from "next/link";
import { CalendarPlus, Download } from "lucide-react";
import { Agenda } from "@/components/agora/agenda";
import { DecisaoAcoes, ReporDecisao } from "@/components/agora/decisao-acoes";
import { FluxoMensalChart, type MonthlyFlowDatum } from "@/components/charts";
import { Folha } from "@/components/folha";
import { CartaoMes } from "@/components/hoje/cartao-mes";
import { Cobertura, Confianca, Money } from "@/components/kit";
import { Badge, buttonClass, Table, Th, Td } from "@/components/ui";
import { getSession } from "@/lib/data";
import { fmtEur, fmtPct, mesPorExtenso, monthLabel, nomeProprio } from "@/lib/format";
import { mesAbaixo } from "@/lib/monthcell";
import { getAgenda, getSnapshotComRaw, type Snapshot } from "@/lib/portfolio";
import { construirFila, emAtrasoDaCarteira, type Insight } from "@/lib/portfolio/insights";
import { resumoDoSnapshot } from "@/lib/portfolio/mes";
import { nomeDaFracao } from "@/lib/portfolio/predios";

export const dynamic = "force-dynamic";

/** Três meses: o que cabe numa leitura. O calendário exportado leva o ano inteiro. */
const DIAS_DA_AGENDA = 92;

export default async function Hoje() {
  const { isAdmin } = await getSession();
  const [{ snap }, agenda] = await Promise.all([
    getSnapshotComRaw(),
    getAgenda(DIAS_DA_AGENDA, { comRendas: isAdmin }),
  ]);

  if (snap.ativos.length === 0) return <Vazio />;

  const mes = resumoDoSnapshot(snap);
  const dia = new Date(`${snap.hoje}T12:00:00Z`).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-8 md:space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-tinta-3">{dia}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-tinta md:text-[30px]">{mes.titulo}</h1>
          <p className="mt-1.5 max-w-[62ch] text-sm text-tinta-2">{mes.contexto}</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/agenda" className={buttonClass({ variant: "outline" })}>
            <CalendarPlus size={15} strokeWidth={1.75} />
            Prazos no calendário
          </a>
          {isAdmin && (
            <a href="/api/export" className={buttonClass({ variant: "ghost" })} title="Cópia de segurança em Excel">
              <Download size={15} strokeWidth={1.75} />
              <span className="hidden sm:inline">Exportar</span>
            </a>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-5">
        <CartaoMes r={mes} />
        <Fluxo snap={snap} />
      </div>

      {isAdmin ? <Tarefas snap={snap} /> : <Atrasados snap={snap} />}

      <Agenda {...agenda} />

      <Cobertura factos={snap.cobertura} podeCorrigir={isAdmin} />
    </div>
  );
}

// ============================================================
// Os últimos 12 meses fechados
// ============================================================

function Fluxo({ snap }: { snap: Snapshot }) {
  const mesCorrente = `${snap.hoje.slice(0, 7)}-01`;
  // Só meses FECHADOS e conhecidos: o corrente está no cartão do lado, e um mês além da
  // fronteira dos dados tem recebido zero porque a app ainda não sabe (bug B2, gráfico).
  const dados: MonthlyFlowDatum[] = snap.fluxo
    .filter((m) => m.month < mesCorrente && (!snap.horizon || m.month <= snap.horizon))
    .map((m) => ({
      month: m.month,
      label: monthLabel(m.month, false),
      esperado: m.esperadoReferencia,
      recebido: m.recebido,
    }));
  const total = dados.reduce((s, d) => s + d.recebido, 0);
  const falhados = dados.filter(mesAbaixo).length;
  const paradas = snap.fontes.filter((f) => f.parada && f.contratos > 0);

  return (
    <section className="rounded-2xl border border-regua bg-carta p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-tinta-3">Meses fechados</p>
        <p className="text-sm text-tinta-2">
          <Money value={total} escala="md" /> registados em {dados.length} meses
        </p>
      </div>
      <div className="mt-2">{dados.length > 0 ? <FluxoMensalChart data={dados} /> : <p className="py-10 text-center text-sm text-tinta-2">Ainda não há meses fechados com recibos importados.</p>}</div>
      <p className="mt-1 text-xs text-tinta-3">
        Tracejado: a renda esperada.{" "}
        {falhados === 0 ? "Nenhum mês abaixo dela." : `${falhados} ${falhados === 1 ? "mês abaixo" : "meses abaixo"}, a âmbar.`}
      </p>
      {paradas.length > 0 && <p className="mt-3 rounded-lg bg-futuro-tenue px-3 py-2 text-xs leading-relaxed text-futuro">Cobertura incompleta: {paradas.map((f) => `${f.landlord.name} só até ${monthLabel(f.horizonte)}`).join("; ")}. Uma descida pode refletir recibos por importar. <Link href="/imoveis?f=parados" className="font-semibold underline underline-offset-2">Ver imóveis</Link></p>}
      {dados.length > 0 && <details className="mt-3 text-xs text-tinta-2"><summary className="cursor-pointer py-2 font-medium">Ver valores mês a mês</summary><Table><thead><tr><Th>Mês</Th><Th className="text-right">Recebido</Th><Th className="text-right">Esperado</Th></tr></thead><tbody>{dados.map((d) => <tr key={d.month}><Td>{monthLabel(d.month)}</Td><Td className="text-right"><Money value={d.recebido} escala="sm" tom={mesAbaixo(d) ? "atencao" : "tinta"} />{mesAbaixo(d) && <span className="sr-only">, abaixo do esperado</span>}</Td><Td className="text-right"><Money value={d.esperado} escala="sm" tom="tinta-2" /></Td></tr>)}</tbody></Table><Link href="/carteira" className="mt-2 inline-flex min-h-11 items-center font-medium text-acao underline">Consultar o histórico por fração</Link></details>}
    </section>
  );
}

// ============================================================
// Admin: para fazer
// ============================================================

const ETIQUETA: Record<Insight["grupo"], { tom: "acao" | "perda" | "futuro" | "atencao"; texto: string }> = {
  fazer: { tom: "acao", texto: "Este mês" },
  risco: { tom: "perda", texto: "Risco" },
  saber: { tom: "futuro", texto: "Por saber" },
  poupar: { tom: "atencao", texto: "Oportunidade" },
};

function Tarefas({ snap }: { snap: Snapshot }) {
  const fila = construirFila(snap);
  const tarefas = fila.itens.filter((i) => i.grupo !== "poupar");
  const oportunidades = fila.itens.filter((i) => i.grupo === "poupar");

  return (
    <div className="space-y-8 md:space-y-10">
      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">Para fazer</h2>
          {tarefas.length > 0 && (
            <p className="text-sm text-tinta-2">
              {tarefas.length} {tarefas.length === 1 ? "tarefa" : "tarefas"} por prioridade
            </p>
          )}
        </div>
        {tarefas.length === 0 ? (
          <p className="rounded-2xl border border-regua bg-carta px-5 py-6 text-sm text-tinta-2">
            Nada para fazer este mês.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:gap-4">
            {tarefas.map((item) => (
              <CartaoTarefa key={item.kind + item.titulo} item={item} snap={snap} />
            ))}
          </ul>
        )}
        {(fila.residuais.n > 0 || fila.silenciadas.length > 0) && (
          <p className="mt-3 text-xs text-tinta-3">
            {fila.residuais.n > 0 &&
              `${fila.residuais.n} abaixo de ${fmtEur(250)}/ano, no total de ${fmtEur(fila.residuais.euros)}.`}
            {fila.silenciadas.length > 0 && (
              <>
                {" "}
                {fila.silenciadas.length} silenciada{fila.silenciadas.length === 1 ? "" : "s"}:{" "}
                {fila.silenciadas.map(({ item, ate, dispensada }, i) => (
                  <span key={item.kind + item.titulo}>
                    {i > 0 && ", "}
                    {item.titulo} (
                    {dispensada ? "dispensada" : `até ${new Date(ate!).toLocaleDateString("pt-PT")}`},{" "}
                    <ReporDecisao kind={item.kind} subject={item.subject} />)
                  </span>
                ))}
              </>
            )}
          </p>
        )}
      </section>

      {oportunidades.length > 0 && (
        <section className="rounded-2xl border border-regua bg-carta p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-[-0.01em]">Oportunidades</h2>
            <Link href="/dinheiro?tab=analise" className="text-sm font-medium text-acao hover:underline">
              Ver em Dinheiro
            </Link>
          </div>
          <p className="mt-0.5 text-sm text-tinta-2">Mudam o rendimento do ano. Não têm prazo.</p>
          <ul className="mt-3 divide-y divide-regua">
            {oportunidades.slice(0, 3).map((i) => (
              <li key={i.kind} className="flex items-baseline justify-between gap-4 py-3">
                <span className="min-w-0 text-[15px] text-tinta">{i.titulo}</span>
                <span className="shrink-0 text-sm">
                  <Money value={i.euros} escala="md" /> <span className="text-xs text-tinta-3">/ano</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CartaoTarefa({ item, snap }: { item: Insight; snap: Snapshot }) {
  const et = ETIQUETA[item.grupo];
  const recibos = item.kind === "recibo_por_emitir" ? snap.recibosPorEmitir : null;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-regua bg-carta p-5">
      <div className="flex items-start justify-between gap-3">
        <div><Money value={item.euros} escala="xl" tom={item.grupo === "risco" ? "perda" : "tinta"} /><p className="mt-1 text-xs text-tinta-3">{item.grupo === "saber" ? "Valor por confirmar" : item.kind === "recibo_por_emitir" ? "Renda bruta a documentar" : item.kind === "atraso" ? "Perda esperada" : "Impacto estimado"}</p></div>
        <Badge tone={et.tom}>{et.texto}</Badge>
      </div>
      <div>
        <p className="text-[15px] font-semibold leading-snug text-tinta">{item.titulo}</p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-tinta-2">{item.porque}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {recibos && recibos.length > 0 && (
          <Folha
            rotulo={`Ver os ${recibos.length}`}
            titulo={`Recibos por emitir em ${mesPorExtenso(`${snap.hoje.slice(0, 7)}-01`)}`}
            subtitulo="No Portal das Finanças, um por contrato."
            variante="primary"
          >
            <ul className="divide-y divide-regua">
              {recibos.map(({ contract, property }) => (
                <li key={contract.id} className="flex items-baseline justify-between gap-3 py-3">
                  <div className="min-w-0">
                    {property ? (
                      <Link href={`/fracoes/${property.id}`} className="font-medium text-tinta hover:text-acao">
                        {nomeDaFracao(property)}
                      </Link>
                    ) : (
                      <span className="font-medium text-tinta">Fração por associar</span>
                    )}
                    <p className="truncate text-xs text-tinta-2">{nomeProprio(contract.tenant_name)}</p>
                  </div>
                  <Money value={contract.rent} className="shrink-0" />
                </li>
              ))}
            </ul>
          </Folha>
        )}
        {item.acoes.map((a) =>
          a.externo ? (
            <a key={a.label} href={a.href} target="_blank" rel="noreferrer" className={buttonClass({ variant: "outline", size: "sm" })}>
              {a.label}
            </a>
          ) : (
            <Link key={a.label} href={a.href} className={buttonClass({ variant: "outline", size: "sm" })}>
              {a.label}
            </Link>
          ),
        )}
        <details className="group ml-auto text-xs">
          <summary className="cursor-pointer select-none rounded-full px-2 py-2 text-tinta-2 hover:bg-vellum hover:text-tinta">
            Detalhes e opções
          </summary>
          <div className="mt-2 space-y-2">
            {item.conta && (
              <p className="text-tinta-3">
                {item.conta} <Confianca nivel={item.confianca} conta={item.conta} />
              </p>
            )}
            <div className="flex gap-1">
              <DecisaoAcoes kind={item.kind} subject={item.subject} />
            </div>
          </div>
        </details>
      </div>
    </li>
  );
}

// ============================================================
// Viewer: quem está em atraso
// ============================================================

function Atrasados({ snap }: { snap: Snapshot }) {
  const ids = new Set(emAtrasoDaCarteira(snap).map((r) => r.propertyId));
  const atrasados = snap.correntes
    .filter((a) => ids.has(a.property.id))
    .sort((a, b) => (b.arrears?.debt ?? 0) - (a.arrears?.debt ?? 0));
  return (
    <section className="rounded-2xl border border-regua bg-carta p-5 md:p-6">
      <h2 className="text-lg font-semibold tracking-[-0.01em]">Quem está em atraso</h2>
      {atrasados.length === 0 ? (
        <p className="mt-2 text-sm text-tinta-2">Ninguém. Todos os meses anteriores estão pagos.</p>
      ) : (
        <ul className="mt-2 divide-y divide-regua">
          {atrasados.map((a) => (
            <li key={a.property.id} className="flex items-baseline justify-between gap-4 py-3">
              <div className="min-w-0">
                <Link href={`/fracoes/${a.property.id}`} className="font-medium text-tinta hover:text-acao">
                  {nomeDaFracao(a.property)}
                </Link>
                <p className="truncate text-sm text-tinta-2">
                  {nomeProprio(a.activeContract?.tenant_name)}
                  {a.arrears && `, ${a.arrears.streak} ${a.arrears.streak === 1 ? "mês" : "meses"} sem pagar`}
                </p>
              </div>
              <Money value={a.arrears?.debt ?? 0} tom="perda" className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
      {atrasados.length > 0 && (
        <p className="mt-2 text-xs text-tinta-3">
          {fmtPct(atrasados.length / Math.max(1, snap.correntes.length), 0)} das frações com algum mês por pagar.
        </p>
      )}
    </section>
  );
}

function Vazio() {
  return (
    <div className="max-w-xl py-10">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Ainda não há carteira.</h1>
      <p className="mt-2 text-sm text-tinta-2">
        Começa por importar os recibos do Portal das Finanças em{" "}
        <Link href="/admin" className="font-medium text-acao hover:underline">
          Admin
        </Link>
        .
      </p>
    </div>
  );
}
