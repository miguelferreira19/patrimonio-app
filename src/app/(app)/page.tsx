// HOJE (V4, REDESENHO.md §4.1, 2026-10-09). Substitui o "Agora" da V2/V3.
//
// A pergunta de quem abre a app é "está tudo pago? o que tenho de fazer?", e era isso que
// a página não respondia primeiro: abria com "12 259 € a ganhar com as decisões", um
// número de estratégia, e despejava 8 blocos com o mesmo peso. Agora a ordem é:
//   1. a frase do mês e o cartão do mês em curso (mes.ts: a ÚNICA manchete);
//   2. os últimos 12 meses FECHADOS (o mês em curso já está no cartão; desenhá-lo no
//      gráfico era o "colapso" de outubro no dia 9);
//   3. DUAS listas separadas (AUDITORIA_CLAREZA.md, ponto 2): "Este mês", o que fecha com
//      uma ação e se repete, por ordem de urgência; e "A investigar", o que está por saber.
//      Numa lista só, ordenadas por euros, a otimização fiscal ficava acima dos recibos;
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
import { fmtEur, mesPorExtenso, monthLabel, nomeProprio } from "@/lib/format";
import { mesAbaixo } from "@/lib/monthcell";
import { getAgenda, getSnapshotComRaw, type Snapshot } from "@/lib/portfolio";
import { UNIDADE_LABEL, construirFila, fontesParadas, type Insight } from "@/lib/portfolio/insights";
import { devedores } from "@/lib/portfolio/inquilinos";
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
          {/* A manchete é o MÊS e uma contagem, não uma frase (AUDITORIA_CLAREZA.md, ponto
              13). Dizia "Faltam 9 rendas de outubro." — o título de história por detrás do
              KPI. A explicação ("os recibos entram com a recolha do dia 15") passou para os
              Detalhes do cartão, que é onde o PLANO_CLAREZA manda pôr explicações. */}
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-tinta-3">{dia}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-tinta md:text-[30px]">
            {mesPorExtenso(mes.mes).replace(/^./, (l) => l.toUpperCase())}
          </h1>
          <p className="mt-1.5 text-sm text-tinta-2">
            <span className="font-medium tabular-nums text-tinta">
              {mes.pagos} de {mes.total}
            </span>{" "}
            rendas recebidas
          </p>
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

      <RecibosSuspensos snap={snap} />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-5">
        <CartaoMes r={mes} />
        <Fluxo snap={snap} />
      </div>

      {/* A MESMA composição para toda a gente (AUDITORIA_CLAREZA.md, ponto 6): a lista de
          quem deve é a primeira leitura de qualquer pessoa da família. O administrador
          recebe as suas listas A SEGUIR, num bloco próprio — sem `isAdmin ?` no meio da
          árvore, que é o que a CLAUDE.md proíbe. */}
      <Atrasados snap={snap} />

      {isAdmin && <Tarefas snap={snap} />}

      <Agenda {...agenda} />

      <Cobertura factos={snap.cobertura} podeCorrigir={isAdmin} />
    </div>
  );
}

// ============================================================
// Recibos suspensos: o maior facto da carteira
// ============================================================

/** O facto maior da carteira deixa de ser um crachá (AUDITORIA_CLAREZA.md, ponto 5).
 *
 *  21 contratos sem recibo desde julho valem muito mais do que a dívida conhecida, e a app
 *  dizia-o num crachá pequeno ("Recibos de Miguel só até jul 2026") e num cartão no meio de
 *  uma fila. Além disso mostrava a TAXA mensal, que não se compara com uma dívida acumulada.
 *  Aqui está o acumulado, em primeiro lugar, pelo mesmo `fontesParadas` das Cobranças. */
function RecibosSuspensos({ snap }: { snap: Snapshot }) {
  const paradas = fontesParadas(snap);
  if (paradas.length === 0) return null;
  return (
    <div className="space-y-3">
      {paradas.map((f) => (
        <section
          key={f.landlord.id}
          className="tecido-futuro flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 rounded-2xl border border-regua bg-futuro-tenue px-5 py-4"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.06em] text-tinta-3">Sem informação</p>
            <p className="mt-1 text-[15px] font-semibold text-tinta">
              Recibos de {nomeProprio(f.landlord.name)} parados desde {mesPorExtenso(f.horizonte, true)}
            </p>
            {/* Sem o `/mês`: a renda da FONTE (6 936 €) não é a mesma coisa que o balde
                "Sem informação" do cartão ao lado (6 845 €, o que falta destes contratos em
                outubro), e dois números parecidos para o que se lê como a mesma coisa é
                exatamente o que esta auditoria anda a corrigir. O acumulado basta. */}
            <p className="mt-0.5 text-sm text-tinta-2">
              {f.contratos} {f.contratos === 1 ? "contrato" : "contratos"} · {f.meses}{" "}
              {f.meses === 1 ? "mês" : "meses"} sem recibo
            </p>
          </div>
          <div className="flex items-baseline gap-4">
            <div className="text-right">
              <Money value={f.acumulado} escala="xl" tom="futuro" />
              <p className="mt-0.5 text-xs font-medium text-tinta-3">acumulado</p>
            </div>
            <Link href="/cobrancas#sem-informacao" className={buttonClass({ variant: "outline", size: "sm" })}>
              Ver contratos
            </Link>
          </div>
        </section>
      ))}
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
        Tracejado: renda esperada{falhados > 0 ? ` · ${falhados} ${falhados === 1 ? "mês abaixo" : "meses abaixo"}` : ""}
      </p>
      {dados.length > 0 && <details className="mt-3 text-xs text-tinta-2"><summary className="cursor-pointer py-2 font-medium">Ver valores mês a mês</summary><Table><thead><tr><Th>Mês</Th><Th className="text-right">Recebido</Th><Th className="text-right">Esperado</Th></tr></thead><tbody>{dados.map((d) => <tr key={d.month}><Td>{monthLabel(d.month)}</Td><Td className="text-right"><Money value={d.recebido} escala="sm" tom={mesAbaixo(d) ? "atencao" : "tinta"} />{mesAbaixo(d) && <span className="sr-only">, abaixo do esperado</span>}</Td><Td className="text-right"><Money value={d.esperado} escala="sm" tom="tinta-2" /></Td></tr>)}</tbody></Table><Link href="/carteira" className="mt-2 inline-flex min-h-11 items-center font-medium text-acao underline">Consultar o histórico por fração</Link></details>}
    </section>
  );
}

// ============================================================
// Admin: para fazer
// ============================================================

const ETIQUETA: Record<Insight["grupo"], { tom: "acao" | "perda" | "futuro" | "atencao"; texto: string }> = {
  fazer: { tom: "acao", texto: "Este mês" },
  risco: { tom: "atencao", texto: "Risco" },
  saber: { tom: "futuro", texto: "Sem informação" },
  poupar: { tom: "atencao", texto: "Oportunidade" },
};

function Tarefas({ snap }: { snap: Snapshot }) {
  const fila = construirFila(snap);
  // DUAS listas, nunca intercaladas (AUDITORIA_CLAREZA.md, ponto 2): o que fecha com uma
  // ação e se repete todos os meses, e o que é trabalho de descoberta. Juntas e ordenadas
  // por euros, "confirmar o prazo de 11 contratos" ficava acima de "emitir os recibos".
  const oportunidades = fila.itens.filter((i) => i.grupo === "poupar" && i.confianca !== "assumido");

  return (
    <div className="space-y-8 md:space-y-10">
      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">Este mês</h2>
          <Link href="/tarefas" className="text-sm font-medium text-acao hover:underline">
            Tarefas registadas
          </Link>
        </div>
        {fila.esteMes.length === 0 ? (
          <p className="rounded-2xl border border-regua bg-carta px-5 py-6 text-sm text-tinta-2">
            Nada para fazer este mês.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:gap-4">
            {fila.esteMes.map((item) => (
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

      {fila.investigar.length > 0 && (
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-[-0.01em]">A investigar</h2>
            <p className="text-sm text-tinta-3">O que a app não sabe, e alguém tem de descobrir</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:gap-4">
            {fila.investigar.map((item) => (
              <CartaoTarefa key={item.kind + item.titulo} item={item} snap={snap} />
            ))}
          </ul>
        </section>
      )}

      {oportunidades.length > 0 && (
        <section className="rounded-2xl border border-regua bg-carta p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-[-0.01em]">Oportunidades</h2>
            <Link href="/rentabilidade" className="text-sm font-medium text-acao hover:underline">
              Ver em Rentabilidade
            </Link>
          </div>
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
        {/* A UNIDADE ao lado do número, no mesmo peso (AUDITORIA_CLAREZA.md, ponto 1). A
            legenda saía antes do `grupo`, e por isso uma poupança fiscal de 5 641 €/ano
            aparecia rotulada "Renda sem informação". */}
        <div>
          {/* Sem valor apurado não se desenha um euro: um "0 €" grande mente mais do que
              não ter número nenhum (auditoria, ponto 16). */}
          {item.unidade === "sem_valor" ? (
            <p className="text-xl font-semibold tracking-[-0.01em] text-tinta-2">Por apurar</p>
          ) : (
            <Money value={item.euros} escala="xl" tom={item.grupo === "risco" ? "atencao" : "tinta"} />
          )}
          <p className="mt-1 text-xs font-medium text-tinta-3">{UNIDADE_LABEL[item.unidade]}</p>
        </div>
        {/* Na secção "Este mês" o crachá repetia o título da secção. */}
        {item.grupo !== "fazer" && <Badge tone={et.tom}>{et.texto}</Badge>}
      </div>
      <p className="text-[15px] font-semibold leading-snug text-tinta">{item.titulo}</p>
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
            Detalhes
          </summary>
          <div className="mt-2 space-y-2">
            <p className="leading-relaxed text-tinta-2">{item.porque}</p>
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

// A MESMA lista das Cobranças, pela MESMA chave (AUDITORIA_CLAREZA.md, ponto 12). O Hoje
// listava os devedores por FRAÇÃO e as Cobranças por INQUILINO: a mesma dívida com duas
// chaves primárias e duas contagens. Quem paga é o inquilino, logo é essa a chave.
function Atrasados({ snap }: { snap: Snapshot }) {
  const lista = devedores(snap);
  const contratos = lista.reduce((n, d) => n + d.contratos.length, 0);
  return (
    <section className="rounded-2xl border border-regua bg-carta p-5 md:p-6">
      <h2 className="text-lg font-semibold tracking-[-0.01em]">Quem está em atraso</h2>
      {lista.length === 0 ? (
        <p className="mt-2 text-sm text-tinta-2">Os registos disponíveis dos meses anteriores estão completos.</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-regua">
            {lista.map((d) => (
              <li key={d.chave} className="flex items-baseline justify-between gap-4 py-3">
                <div className="min-w-0">
                  <Link href={`/inquilinos/${encodeURIComponent(d.chave)}`} className="font-medium text-tinta hover:text-acao">
                    {nomeProprio(d.nome)}
                  </Link>
                  <p className="truncate text-sm text-tinta-2">
                    {d.contratos.map((c) => (c.property ? nomeDaFracao(c.property) : "fração")).join(", ")}
                    {` · desde ${monthLabel(d.desde)}`}
                  </p>
                </div>
                <Money value={d.divida} tom="atencao" className="shrink-0" />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-tinta-3">
            {lista.length} {lista.length === 1 ? "inquilino" : "inquilinos"} · {contratos}{" "}
            {contratos === 1 ? "contrato" : "contratos"}.{" "}
            <Link href="/cobrancas" className="font-medium text-acao underline underline-offset-2">Ver em Cobranças</Link>
          </p>
        </>
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
