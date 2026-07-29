// O AGORA (PLANO.md §4, revisto na V3).
//
// A V2 fez esta página falar. A V3 fá-la calar-se: o topo era uma frase inteira como
// título mais outra como descrição, cada decisão trazia cinco elementos de texto, e o
// gráfico levava um parágrafo a explicar-se. Oito decisões davam uma parede de texto.
//
// Agora: um número herói (R1), agrupamento por hairline em vez de cartões (R2), o porquê
// atrás de um `<details>` em vez de sempre ligado (R3), e nenhum parágrafo a explicar um
// gráfico (R4). As regras estão no V3.md.
//
// As duas leituras estão separadas em vez de entrelaçadas por ternários: quem decide vê a
// fila, quem só confirma vê o estado. Eram a mesma árvore com `isAdmin ?` em sete sítios,
// e era isso que tornava a página impossível de ler no código e no ecrã.

import Link from "next/link";
import { CheckCircle2, Download, Plus } from "lucide-react";
import { DecisaoAcoes, ReporDecisao } from "@/components/agora/decisao-acoes";
import { Retrato } from "@/components/agora/retrato";
import { AcumuladoChart, type AcumuladoDatum } from "@/components/charts";
import { buttonClass, EmptyState } from "@/components/ui";
import { Cobertura, Confianca, Lede, Money, Seccao } from "@/components/kit";
import { getSession } from "@/lib/data";
import { getSnapshot, type Snapshot } from "@/lib/portfolio";
import { GRUPO_LABEL, agrupar, construirFila } from "@/lib/portfolio/insights";
import { fmtEur, fmtPct, monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AgoraPage() {
  const [{ isAdmin }, snap] = await Promise.all([getSession(), getSnapshot()]);

  if (snap.ativos.length === 0) return <Vazio />;

  const thisMonth = snap.meses[snap.meses.length - 1];

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <Decisoes snap={snap} thisMonth={thisMonth} />
      ) : (
        <Estado snap={snap} />
      )}

      <Acumulado snap={snap} />
    </div>
  );
}

/** O ano até hoje contra o ano passado. Foi o que faltou desde sempre: a app tinha 12 anos
 *  de série mensal na base e mostrava 12 meses móveis, que nunca respondem a "quanto já
 *  entrou este ano?". */
function Acumulado({ snap }: { snap: Snapshot }) {
  if (snap.acumulado.length === 0) return null;

  const data: AcumuladoDatum[] = snap.acumulado.map((p) => ({
    label: monthLabel(p.mes, false),
    esteAno: p.esteAno,
    anoAnterior: p.anoAnterior,
  }));

  // O último ponto com valor é onde o ano vai. A comparação é contra o MESMO ponto do ano
  // anterior, nunca contra o ano anterior inteiro, senão em janeiro a carteira parece
  // estar a perder 90%.
  const ultimo = [...snap.acumulado].reverse().find((p) => p.esteAno !== null);
  const delta = ultimo ? ultimo.esteAno! - ultimo.anoAnterior : 0;
  const variacao = ultimo && ultimo.anoAnterior > 0 ? delta / ultimo.anoAnterior : null;

  return (
    <section>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-regua pb-1.5">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">
          Acumulado do ano
        </h2>
        {ultimo && (
          <p className="text-xs text-tinta-2">
            <Money value={ultimo.esteAno!} escala="sm" />
            {" até "}
            {monthLabel(ultimo.mes, false)}
            {variacao !== null && (
              <span className={delta < 0 ? "text-perda" : "text-tinta-2"}>
                {" · "}
                {delta >= 0 ? "+" : ""}
                {fmtPct(variacao, 0)} face ao ano passado
              </span>
            )}
          </p>
        )}
      </header>
      <AcumuladoChart data={data} />
    </section>
  );
}

// ============================================================
// Quem só confirma
// ============================================================

/** A pergunta do viewer não é "o que faço?", é "como é que isto está?". Um número grande,
 *  os seis do retrato, e quem está em atraso. Nada mais: não tem botões, e uma fila de
 *  decisões sem botões é uma lista de frustrações. */
function Estado({ snap }: { snap: Snapshot }) {
  const atrasados = snap.correntes
    .filter((a) => (a.arrears?.streak ?? 0) > 0)
    .sort((a, b) => (b.arrears?.debt ?? 0) - (a.arrears?.debt ?? 0));

  return (
    <>
      <Lede eyebrow="Últimos 12 meses" title={<Money value={snap.totais.recebido12m} escala="hero" />}>
        {snap.correntes.length} frações,{" "}
        {snap.ocupacao.vagas.length === 0
          ? "todas arrendadas"
          : `${snap.ocupacao.vagas.length} por arrendar`}
        {snap.horizon ? `. Contas fechadas até ${monthLabel(snap.horizon)}.` : "."}
      </Lede>

      <Retrato snap={snap} />

      <Seccao titulo="Quem está em atraso">
        {atrasados.length === 0 ? (
          <EmptyState icon={CheckCircle2}>Nenhum contrato em atraso.</EmptyState>
        ) : (
          <ul className="divide-y divide-regua">
            {atrasados.map((a) => (
              <li key={a.property.id} className="flex items-baseline justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <Link href={`/fracoes/${a.property.id}`} className="font-medium text-tinta hover:text-acao">
                    {a.property.name}
                  </Link>
                  <p className="truncate text-sm text-tinta-2">
                    {a.activeContract?.tenant_name}
                    {a.arrears && `, ${a.arrears.streak} ${a.arrears.streak === 1 ? "mês" : "meses"} sem pagar`}
                  </p>
                </div>
                <Money value={a.arrears?.debt ?? 0} escala="lg" tom="perda" className="shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </Seccao>
    </>
  );
}

// ============================================================
// Quem decide
// ============================================================

function Decisoes({ snap, thisMonth }: { snap: Snapshot; thisMonth: string }) {
  const fila = construirFila(snap);
  const grupos = agrupar(fila.itens);
  const n = fila.itens.length;

  return (
    <>
      <Lede
        eyebrow={monthLabel(thisMonth)}
        title={n === 0 ? "Nada a decidir." : <Money value={fila.total} escala="hero" tom="acao" />}
        actions={
          <>
            <a href="/api/export" className={buttonClass({ variant: "outline" })}>
              <Download size={15} strokeWidth={1.75} />
              Exportar
            </a>
            <Link href="/carteira?lente=cobranca" className={buttonClass()}>
              <Plus size={15} strokeWidth={2} />
              Registar pagamento
            </Link>
          </>
        }
      >
        {n === 0
          ? `A carteira está em ordem. Cobraste ${fmtPct(snap.fluxo[snap.fluxo.length - 1].taxa, 0)} do esperado este mês.`
          : `A ganhar este ano, se fizeres as ${n} coisas em baixo.`}
      </Lede>

      <Cobertura factos={snap.cobertura} />

      <Retrato snap={snap} />

      {n === 0 ? (
        <EmptyState icon={CheckCircle2}>
          Nenhuma decisão acima do limiar de materialidade.
          {fila.residuais.n > 0 &&
            ` ${fila.residuais.n} ${fila.residuais.n === 1 ? "sinal" : "sinais"} abaixo de ${fmtEur(250)}/ano.`}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <Seccao
              key={g.grupo}
              titulo={GRUPO_LABEL[g.grupo]}
              valor={<Money value={g.euros} escala="sm" tom="tinta-2" />}
            >
              {/* Caixas, nao uma lista: com 6-8 decisoes a lista virava uma coluna
                  comprida a pedir scroll, e o que interessa e ver o conjunto de uma vez.
                  Hairline e nao Card — nada disto esta elevado (R2). */}
              <ul className="grid gap-3 sm:grid-cols-2">
                {g.itens.map((item) => (
                  <li
                    key={item.kind + item.titulo}
                    className="rounded-xl border border-regua bg-carta p-3.5"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-[15px] font-medium text-tinta">{item.titulo}</p>
                      <Money
                        value={item.euros}
                        escala="lg"
                        tom={item.grupo === "risco" ? "perda" : "acao"}
                        className="shrink-0"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {item.acoes.map((a) =>
                        a.externo ? (
                          <a
                            key={a.label}
                            href={a.href}
                            target="_blank"
                            rel="noreferrer"
                            className={buttonClass({ variant: "outline", size: "sm" })}
                          >
                            {a.label}
                          </a>
                        ) : (
                          <Link
                            key={a.label}
                            href={a.href}
                            className={buttonClass({ variant: "outline", size: "sm" })}
                          >
                            {a.label}
                          </Link>
                        ),
                      )}
                      <DecisaoAcoes kind={item.kind} subject={item.subject} />
                      {/* R3: o porquê e a aritmética existem sempre, mas não gastam uma
                          linha por item enquanto ninguém os pede. */}
                      <details className="ml-auto text-xs">
                        <summary className="cursor-pointer select-none text-tinta-3 hover:text-tinta-2">
                          porquê
                        </summary>
                        <p className="mt-1.5 max-w-[60ch] text-tinta-2">{item.porque}</p>
                        {item.conta && (
                          <p className="mt-1 text-tinta-3">
                            {item.conta} <Confianca nivel={item.confianca} conta={item.conta} />
                          </p>
                        )}
                      </details>
                    </div>
                  </li>
                ))}
              </ul>
            </Seccao>
          ))}

          {(fila.residuais.n > 0 || fila.silenciadas.length > 0) && (
            <p className="border-t border-regua pt-3 text-xs text-tinta-3">
              {fila.residuais.n > 0 &&
                `${fila.residuais.n} abaixo de ${fmtEur(250)}/ano, no total de ${fmtEur(fila.residuais.euros)}.`}
              {fila.silenciadas.length > 0 && (
                <>
                  {" "}
                  {fila.silenciadas.length} silenciada{fila.silenciadas.length === 1 ? "" : "s"}:{" "}
                  {fila.silenciadas.map(({ item, ate, dispensada }, i) => (
                    <span key={item.kind + item.titulo}>
                      {i > 0 && ", "}
                      {item.titulo} ({dispensada ? "dispensada" : `até ${new Date(ate!).toLocaleDateString("pt-PT")}`},{" "}
                      <ReporDecisao kind={item.kind} subject={item.subject} />)
                    </span>
                  ))}
                </>
              )}
            </p>
          )}
        </div>
      )}

      {snap.recibosPorEmitir.length > 0 && (
        <Seccao titulo={`Recibos por emitir em ${monthLabel(thisMonth)}`}>
          <ul className="grid max-h-72 gap-x-8 overflow-y-auto sm:grid-cols-2">
            {snap.recibosPorEmitir.map(({ contract, property }) => (
              <li
                key={contract.id}
                className="flex items-baseline justify-between gap-3 border-b border-regua py-2"
              >
                <div className="min-w-0">
                  {property ? (
                    <Link href={`/fracoes/${property.id}`} className="font-medium text-tinta hover:text-acao">
                      {property.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-tinta">?</span>
                  )}
                  <p className="truncate text-xs text-tinta-2">{contract.tenant_name}</p>
                </div>
                <Money value={contract.rent} className="shrink-0" />
              </li>
            ))}
          </ul>
        </Seccao>
      )}
    </>
  );
}

// ============================================================
// Peças partilhadas
// ============================================================

function Vazio() {
  return (
    <Lede title="Ainda não há carteira.">
      Começa por importar os recibos do Portal das Finanças em{" "}
      <Link href="/admin" className="font-medium text-acao hover:underline">
        Admin
      </Link>
      , ou cria uma fração em{" "}
      <Link href="/carteira?lente=renda" className="font-medium text-acao hover:underline">
        Carteira
      </Link>
      .
    </Lede>
  );
}
