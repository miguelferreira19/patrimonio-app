// O AGORA (PLANO.md §4, revisto na V3, reordenado em 2026-07-29).
//
// A V2 fez esta página falar. A V3 fê-la calar-se: um número herói (R1), agrupamento por
// hairline em vez de cartões (R2), o porquê atrás de um `<details>` (R3), e nenhum
// parágrafo a explicar um gráfico (R4).
//
// O QUE MUDOU AGORA, e porquê. A página tinha QUATRO aberturas em fila — número herói,
// tira de cobertura, seis números do retrato, e só depois o conteúdo — todas com o mesmo
// peso visual. Quatro coisas a falar ao mesmo tempo é o mesmo que nenhuma: o olho não tem
// onde pousar, e era isso, e não a cor, que fazia a página parecer densa.
//
// A ordem passa a ser a de uma primeira página:
//   1. A ABERTURA — o número que importa e, ao lado, a curva do ano. Juntos, porque
//      respondem à mesma pergunta ("como vai isto?") e separados obrigavam a atravessar a
//      página inteira para cruzar os dois. A curva era o ÚLTIMO bloco; é o objeto mais
//      legível que aqui existe e estava escondido no fim.
//   2. O CONTEXTO — o retrato dos seis números, colado por baixo da curva (pedido do
//      utilizador, 2026-07-30). Estava no fim da página, a três écrans de distância do
//      gráfico que explica: quem lê "acumulado do ano" quer logo a seguir saber quanto
//      está contratado e quanto está em atraso. Continua em voz baixa — é referência,
//      não manchete.
//   3. O CORPO — as decisões (admin) ou quem está em atraso (viewer).
//   4. O RODAPÉ DE HONESTIDADE — a cobertura. Continua a dizer tudo o que a app não sabe,
//      mas deixa de disputar a atenção com o dinheiro logo no topo: informação sobre o
//      CONHECIMENTO não é manchete (PLANO.md §7.5).
//
// As duas leituras continuam separadas em vez de entrelaçadas por ternários: quem decide
// vê a fila, quem só confirma vê o estado.

import Link from "next/link";
import { CheckCircle2, Download } from "lucide-react";
import { DecisaoAcoes, ReporDecisao } from "@/components/agora/decisao-acoes";
import { Retrato } from "@/components/agora/retrato";
import { FluxoMensalChart, type MonthlyFlowDatum } from "@/components/charts";
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
    <div className="space-y-12">
      {isAdmin ? <Decisoes snap={snap} thisMonth={thisMonth} /> : <Estado snap={snap} />}

      {/* Honestidade no fim: informação sobre o CONHECIMENTO não é manchete. O retrato dos
          seis números subiu daqui para logo abaixo do gráfico, dentro da Abertura. */}
      <Cobertura factos={snap.cobertura} />
    </div>
  );
}

// ============================================================
// A abertura: o número que importa, e a curva do ano ao lado
// ============================================================

/** Duas colunas assimétricas (5/7): o número precisa de ar à volta, a curva precisa de
 *  largura. No telemóvel empilham, e o número vem primeiro — é o que se lê num relance. */
function Abertura({ snap, children }: { snap: Snapshot; children: React.ReactNode }) {
  // MÊS A MÊS, não acumulado (2026-07-31, pedido do utilizador). A curva do acumulado só
  // sabia dizer "o ano vai melhor ou pior do que o anterior": subia sempre, e um mês mau
  // era uma inflexão que ninguém via. O que se quer saber é quanto entrou em cada mês e se
  // ficou aquém do esperado — e isso é uma barra por mês.
  //
  // Corta-se na FRONTEIRA dos dados: um mês ainda não importado tem recebido zero, e
  // desenhá-lo era um penhasco que diz "ninguém pagou" quando o que se passa é que a app
  // ainda não sabe (é o bug B2, na versão gráfico).
  const dados: MonthlyFlowDatum[] = snap.fluxo
    .filter((m) => !snap.horizon || m.month <= snap.horizon)
    .map((m) => ({
      month: m.month,
      label: monthLabel(m.month, false),
      esperado: m.esperadoReferencia,
      recebido: m.recebido,
    }));

  const ultimo = dados[dados.length - 1];
  const anterior = dados[dados.length - 2];
  const delta = ultimo && anterior ? ultimo.recebido - anterior.recebido : 0;
  const variacao = ultimo && anterior && anterior.recebido > 0 ? delta / anterior.recebido : null;
  const falhados = dados.filter((m) => m.recebido + 0.5 < m.esperado).length;

  if (dados.length === 0) {
    return (
      <section className="space-y-8">
        {children}
        <Retrato snap={snap} />
      </section>
    );
  }

  return (
    <section className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">{children}</div>

      <div className="lg:col-span-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-regua pb-1.5">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">
            Entrou por mês
          </h2>
          {ultimo && (
            <p className="text-xs text-tinta-2">
              <Money value={ultimo.recebido} escala="sm" />
              {" em "}
              {ultimo.label}
              {variacao !== null && (
                <span className={delta < 0 ? "text-perda" : "text-tinta-2"}>
                  {" · "}
                  {delta >= 0 ? "+" : ""}
                  {fmtPct(variacao, 0)} face ao mês anterior
                </span>
              )}
            </p>
          )}
        </div>
        <div className="mt-3">
          <FluxoMensalChart data={dados} />
        </div>
        <p className="mt-2 text-[11px] text-tinta-3">
          A linha tracejada é a renda esperada.{" "}
          {falhados === 0
            ? `Nenhum dos ${dados.length} meses ficou abaixo dela.`
            : `${falhados} ${falhados === 1 ? "mês ficou" : "meses ficaram"} abaixo dela, a âmbar.`}
        </p>
      </div>

      {/* Os seis números atravessam as duas colunas, encostados por baixo do gráfico. */}
      <Retrato snap={snap} className="lg:col-span-12" />
    </section>
  );
}

// ============================================================
// Quem só confirma
// ============================================================

/** A pergunta do viewer não é "o que faço?", é "como é que isto está?". Um número grande,
 *  a curva do ano, e quem está em atraso. Nada mais: não tem botões, e uma fila de
 *  decisões sem botões é uma lista de frustrações. */
function Estado({ snap }: { snap: Snapshot }) {
  const atrasados = snap.correntes
    .filter((a) => (a.arrears?.streak ?? 0) > 0)
    .sort((a, b) => (b.arrears?.debt ?? 0) - (a.arrears?.debt ?? 0));
  const totalEmAtraso = atrasados.reduce((acc, a) => acc + (a.arrears?.debt ?? 0), 0);

  return (
    <div className="space-y-12">
      <Abertura snap={snap}>
        <Lede
          eyebrow="Últimos 12 meses"
          title={<Money value={snap.totais.recebido12m} escala="hero" />}
        >
          {snap.correntes.length} frações,{" "}
          {snap.ocupacao.vagas.length === 0
            ? "todas arrendadas"
            : `${snap.ocupacao.vagas.length} por arrendar`}
          {snap.horizon ? `. Contas fechadas até ${monthLabel(snap.horizon)}.` : "."}
        </Lede>
      </Abertura>

      <Seccao
        titulo="Quem está em atraso"
        valor={
          atrasados.length > 0 ? <Money value={totalEmAtraso} escala="sm" tom="perda" /> : undefined
        }
      >
        {atrasados.length === 0 ? (
          <EmptyState icon={CheckCircle2}>Nenhum contrato em atraso.</EmptyState>
        ) : (
          <ul className="divide-y divide-regua">
            {atrasados.map((a) => (
              <li key={a.property.id} className="flex items-baseline justify-between gap-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/fracoes/${a.property.id}`}
                    className="font-medium text-tinta transition-colors duration-150 hover:text-acao"
                  >
                    {a.property.name}
                  </Link>
                  <p className="truncate text-sm text-tinta-2">
                    {a.activeContract?.tenant_name}
                    {a.arrears &&
                      `, ${a.arrears.streak} ${a.arrears.streak === 1 ? "mês" : "meses"} sem pagar`}
                  </p>
                </div>
                <Money value={a.arrears?.debt ?? 0} escala="lg" tom="perda" className="shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </Seccao>
    </div>
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
    <div className="space-y-12">
      <Abertura snap={snap}>
        <Lede
          title={n === 0 ? "Nada a decidir." : <Money value={fila.total} escala="hero" tom="acao" />}
          actions={
            <a href="/api/export" className={buttonClass({ variant: "outline" })}>
              <Download size={15} strokeWidth={1.75} />
              Exportar
            </a>
          }
        >
          {n === 0
            ? `A carteira está em ordem. Cobraste ${fmtPct(snap.fluxo[snap.fluxo.length - 1].taxa, 0)} do esperado este mês.`
            : `A ganhar este ano, se fizeres as ${n} coisas em baixo.`}
        </Lede>
      </Abertura>

      {n === 0 ? (
        <EmptyState icon={CheckCircle2}>
          Nenhuma decisão acima do limiar de materialidade.
          {fila.residuais.n > 0 &&
            ` ${fila.residuais.n} ${fila.residuais.n === 1 ? "sinal" : "sinais"} abaixo de ${fmtEur(250)}/ano.`}
        </EmptyState>
      ) : (
        <div className="space-y-10">
          {grupos.map((g) => (
            <Seccao
              key={g.grupo}
              titulo={GRUPO_LABEL[g.grupo]}
              valor={<Money value={g.euros} escala="sm" tom="tinta-2" />}
            >
              {/* Caixas, não uma lista: com 6-8 decisões a lista virava uma coluna
                  comprida a pedir scroll, e o que interessa é ver o conjunto de uma vez.
                  Hairline e não Card — nada disto está elevado (R2). A régua fina da
                  esquerda separa "a ganhar" de "a perder" sem gastar um fundo de cor. */}
              <ul className="grid gap-3 sm:grid-cols-2">
                {g.itens.map((item) => (
                  <li
                    key={item.kind + item.titulo}
                    className="relative overflow-hidden rounded-xl border border-regua bg-carta p-4 transition-colors duration-200 hover:border-regua-forte"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 w-[2px] ${
                        item.grupo === "risco" ? "bg-perda/40" : "bg-acao/40"
                      }`}
                    />
                    {/* O valor primeiro e sozinho na linha: a pergunta é sempre "quanto
                        vale isto?", e um número encostado ao título perde-se ao lado dele. */}
                    <Money
                      value={item.euros}
                      escala="lg"
                      tom={item.grupo === "risco" ? "perda" : "acao"}
                    />
                    <p className="mt-1 text-[15px] font-medium leading-snug text-tinta">
                      {item.titulo}
                    </p>

                    <div className="mt-3.5 flex flex-wrap items-center gap-2">
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
                        <summary className="cursor-pointer select-none text-tinta-3 transition-colors duration-150 hover:text-tinta-2">
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
                      {item.titulo} (
                      {dispensada ? "dispensada" : `até ${new Date(ate!).toLocaleDateString("pt-PT")}`},{" "}
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
                    <Link
                      href={`/fracoes/${property.id}`}
                      className="font-medium text-tinta transition-colors duration-150 hover:text-acao"
                    >
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
    </div>
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
