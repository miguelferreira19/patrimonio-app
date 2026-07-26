import Link from "next/link";
import { CheckCircle2, Download, Plus } from "lucide-react";
import { DecisaoAcoes, ReporDecisao } from "@/components/agora/decisao-acoes";
import { Retrato } from "@/components/agora/retrato";
import {
  CollectionRateChart,
  FlowLegend,
  MonthlyFlowChart,
  type CollectionRateDatum,
  type MonthlyFlowDatum,
} from "@/components/charts";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { Cobertura, Confianca, Money } from "@/components/kit";
import { getSession } from "@/lib/data";
import { getSnapshot } from "@/lib/portfolio";
import { GRUPO_LABEL, agrupar, construirFila } from "@/lib/portfolio/insights";
import { fmtEur, fmtPct, monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AgoraPage() {
  const [{ isAdmin }, snap] = await Promise.all([getSession(), getSnapshot()]);
  const thisMonth = snap.meses[snap.meses.length - 1];

  if (snap.ativos.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Agora" description={monthLabel(thisMonth)} />
        <Card title="Bem-vindo">
          <p className="text-sm text-tinta-2">
            Começa por importar os recibos do Portal das Finanças em{" "}
            <Link href="/admin" className="font-medium text-acao hover:underline">
              Admin → Importar
            </Link>
            , ou cria frações manualmente em{" "}
            <Link href="/carteira?lente=renda" className="font-medium text-acao hover:underline">
              Frações
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  const fila = construirFila(snap);
  const grupos = agrupar(fila.itens);
  const currentAgg = snap.fluxo[snap.fluxo.length - 1];
  const nItens = fila.itens.length;

  const flowData: MonthlyFlowDatum[] = snap.fluxo.map((m) => ({
    month: m.month,
    label: monthLabel(m.month, m.month.slice(5, 7) === "01"),
    esperado: m.esperadoContratado,
    recebido: m.recebido,
    liquido: m.liquido,
  }));
  const rateData: CollectionRateDatum[] = snap.fluxo.map((m) => ({
    label: monthLabel(m.month, m.month.slice(5, 7) === "01"),
    taxa: m.taxa,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={monthLabel(thisMonth)}
        title={
          !isAdmin ? (
            <>
              A carteira rendeu <Money value={snap.totais.recebido12m} escala="hero" tom="tinta" />{" "}
              nos últimos 12 meses.
            </>
          ) : nItens === 0 ? (
            "Nada a decidir."
          ) : (
            <>
              Se fizeres estas {nItens} {nItens === 1 ? "coisa" : "coisas"}, ganhas{" "}
              <Money value={fila.total} escala="hero" tom="acao" /> este ano.
            </>
          )
        }
        description={
          !isAdmin
            ? `${snap.correntes.length} frações${snap.horizon ? `, com recibos até ${monthLabel(snap.horizon)}` : ""}. ${
                snap.arrears.summary.contractsInArrears === 0
                  ? "Nenhum contrato em atraso."
                  : `${snap.arrears.summary.contractsInArrears} contratos em atraso, a serem tratados.`
              }`
            : nItens === 0
            ? `A carteira está em ordem${snap.horizon ? ` até ${monthLabel(snap.horizon)}` : ""}. Cobraste ${fmtPct(currentAgg.taxa, 0)} do esperado este mês.`
            : fila.totalAssumido > 0
              ? `Mais ${fmtEur(fila.totalAssumido)} dependem de premissas que a app não confirma, e por isso não entram no número acima.`
              : undefined
        }
        actions={
          <>
            {isAdmin && (
              <a href="/api/export" className={buttonClass({ variant: "outline" })}>
                <Download size={15} strokeWidth={1.75} />
                Exportar
              </a>
            )}
            {isAdmin && (
              <Link href="/carteira?lente=cobranca" className={buttonClass()}>
                <Plus size={15} strokeWidth={2} />
                Registar pagamento
              </Link>
            )}
          </>
        }
      />

      <Cobertura factos={snap.cobertura} />

      {/* O retrato: como a carteira ESTÁ, antes de qualquer decisão. É a resposta à
          pergunta do viewer ("como é que isto está?"), que a fila não responde — e para
          quem decide serve de contexto ao que vem a seguir. */}
      <Retrato snap={snap} />

      {/* A fila só aparece a quem pode agir. Um viewer não tem botões, por isso uma fila
          de decisões seria uma lista de frustrações — vê o retrato e o fluxo. */}
      {isAdmin ? (
        nItens === 0 ? (
          <EmptyState icon={CheckCircle2}>
            Nenhuma decisão acima do limiar de materialidade.
            {fila.residuais.n > 0 &&
              ` ${fila.residuais.n} ${fila.residuais.n === 1 ? "sinal" : "sinais"} abaixo de ${fmtEur(250)}/ano.`}
          </EmptyState>
        ) : (
          <div className="space-y-5">
            {grupos.map((g) => (
              <section key={g.grupo}>
                <header className="mb-2 flex items-baseline justify-between gap-3 border-b border-regua pb-1.5">
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">
                    {GRUPO_LABEL[g.grupo]}
                  </h2>
                  <Money value={g.euros} escala="sm" tom="tinta-2" />
                </header>
                <ul className="divide-y divide-regua">
                  {g.itens.map((item) => (
                    <li
                      key={item.kind + item.titulo}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-tinta">{item.titulo}</p>
                        <p className="mt-0.5 text-sm text-tinta-2">{item.porque}</p>
                        {item.conta && (
                          <p className="mt-1 text-xs text-tinta-3">
                            {item.conta} <Confianca nivel={item.confianca} conta={item.conta} />
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
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
                        </div>
                      </div>
                      <Money
                        value={item.euros}
                        escala="lg"
                        tom={item.grupo === "risco" ? "perda" : "acao"}
                        className="shrink-0 sm:text-right"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {fila.residuais.n > 0 && (
              <p className="border-t border-regua pt-3 text-xs text-tinta-3">
                {fila.residuais.n} {fila.residuais.n === 1 ? "sinal" : "sinais"} abaixo do limiar de
                materialidade ({fmtEur(250)}/ano), no total de {fmtEur(fila.residuais.euros)}. A app
                não os mostra para não gastar a tua atenção com eles.
              </p>
            )}
            {fila.silenciadas.length > 0 && (
              <details className="border-t border-regua pt-3 text-xs text-tinta-3">
                <summary className="cursor-pointer select-none">
                  {fila.silenciadas.length}{" "}
                  {fila.silenciadas.length === 1 ? "decisão silenciada" : "decisões silenciadas"}
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {fila.silenciadas.map(({ item, ate, dispensada }) => (
                    <li key={item.kind + item.titulo} className="flex flex-wrap gap-x-2">
                      <span className="text-tinta-2">{item.titulo}</span>
                      <span>
                        {dispensada
                          ? "dispensada"
                          : `adiada até ${new Date(ate!).toLocaleDateString("pt-PT")}`}
                        {" · "}
                        <ReporDecisao kind={item.kind} subject={item.subject} />
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )
      ) : null}

      {isAdmin && (
      <Card
        title="Este mês: recibos por emitir"
        subtitle={`${monthLabel(thisMonth)} · contratos ativos ainda sem recibo emitido`}
      >
        {snap.recibosPorEmitir.length === 0 ? (
          <EmptyState icon={CheckCircle2}>
            Todos os contratos ativos já têm recibo deste mês.
          </EmptyState>
        ) : (
          <div className="grid max-h-80 gap-2 overflow-y-auto md:grid-cols-2">
            {snap.recibosPorEmitir.map(({ contract, property }) => (
              <div
                key={contract.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-regua p-3"
              >
                <div className="min-w-0">
                  {property ? (
                    <Link
                      href={`/fracoes/${property.id}`}
                      className="font-medium text-acao hover:underline"
                    >
                      {property.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-tinta">?</span>
                  )}
                  <p className="truncate text-xs text-tinta-2">{contract.tenant_name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Money value={contract.rent} />
                  {contract.pf_contract_no && (
                    <p className="font-mono text-xs text-tinta-3">{contract.pf_contract_no}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      )}

      {/* O gráfico voltou (pedido do utilizador, 2026-07-25). Sai da Fase 7 a decisão de
          o apagar: a faixa da Carteira responde "que meses falharam, em que fração", e
          este responde "quanto entrou contra quanto era esperado, mês a mês" — e é essa a
          leitura que a família quer. Fica DEPOIS da fila, porque contexto não se põe à
          frente de uma decisão. */}
      <Card title="Últimos 12 meses" subtitle="esperado, recebido e líquido" actions={<FlowLegend />}>
        <MonthlyFlowChart data={flowData} />
        <div className="mt-4 border-t border-regua pt-3">
          <p className="mb-1 text-xs font-medium text-tinta-2">Taxa de cobrança mensal</p>
          <CollectionRateChart data={rateData} />
        </div>
        <p className="mt-3 text-xs text-tinta-3">
          Mês a mês, a carteira inteira. Para ver que fração falhou que mês, a{" "}
          <Link href="/carteira" className="text-acao hover:underline">
            faixa da Carteira
          </Link>{" "}
          mostra as duas coisas ao mesmo tempo.
        </p>
      </Card>
    </div>
  );
}
