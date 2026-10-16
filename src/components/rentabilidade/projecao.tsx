// A ANÁLISE (V3): a quarta superfície, e a única que é só do administrador.
//
// Porque existe. As três superfícies da V2 respondem ao presente: o Agora diz o que fazer
// hoje, a Carteira diz o que aconteceu, o Ano diz quanto se paga de imposto. Nenhuma olha
// para a frente, e nenhuma responde às perguntas de dono: estou demasiado exposto a um
// inquilino? a renda está a crescer ou a app só parece maior? dá para comprar outra?
//
// Fica fora do Agora de propósito. Meter isto lá dentro engordava a superfície do ritual
// mensal e trazia de volta o dashboard que a V2 matou: quem abre a app para cobrar rendas
// não quer um CAGR pelo caminho.
//
// Ótica de família (valores por inteiro, sem repartir por quotas), como o resto da app.

import { redirect } from "next/navigation";
import Link from "next/link";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import { ProjecaoChart, type ProjecaoDatum } from "@/components/charts";
import { Confianca, Figure, Lede, Money, Seccao } from "@/components/kit";
import { buttonClass } from "@/components/ui";
import { getSession } from "@/lib/data";
import { getSnapshotComRaw, buildSnapshot } from "@/lib/portfolio";
import { scopeRaw } from "@/lib/portfolio/ambito";
import { OwnerSelection, ScopeFilters } from "@/components/gestao/operacional";
import { AMBITO_LABEL, type Ambito } from "@/lib/gestao";
import { horizontePorContrato } from "@/lib/arrears";
import { construirConselhos, type Conselho } from "@/lib/portfolio/conselhos";
import { capacidadeDeInvestimento, projetar, resumoDaProjecao } from "@/lib/portfolio/futuro";
import { concentracao, crescimento, rendasParadas, serieAnual } from "@/lib/portfolio/renda";
import { fmtEur, fmtPct, monthLabel } from "@/lib/format";


const MESES_PROJETADOS = 24;

export default async function AnalisePage({ searchParams }: { searchParams: Promise<{ ambito?: string; senhorio?: string }> }) {
  const { isAdmin } = await getSession();
  if (!isAdmin) redirect("/");

  const q = await searchParams ?? {}; const original = await getSnapshotComRaw();
  const scope: Ambito = ["carteira", "proprietario"].includes(q.ambito ?? "") ? q.ambito as Ambito : "inteiro";
  if (scope === "proprietario" && !original.raw.landlords.some((l) => l.id === q.senhorio)) return <OwnerSelection title="Projeção de receitas · 24 meses" q={q} landlords={original.raw.landlords} action="/rentabilidade" hidden={{ tab: "projecao" }} />;
  const scoped = scopeRaw(original.raw, scope, q.senhorio); const raw = scoped.raw; const today = original.today; const snap = scope === "inteiro" ? original.snap : buildSnapshot(raw, today);
  const horizons = horizontePorContrato(original.raw.receiptsRecentes.flatMap((r) => r.landlord_id ? [{ ...r, landlord_id: r.landlord_id, issue_date: r.issue_date ?? null }] : []), today).porContrato;
  const forecastContracts = raw.contracts.map((c) => c.status === "ativo" && c.term_kind === "prazo_certo" && c.terms_confirmed_at && c.term_source && c.expected_end_date ? { ...c, end_date: c.expected_end_date } : c);

  const projecao = projetar({
    contracts: forecastContracts,
    payments: raw.payments,
    hoje: today,
    meses: MESES_PROJETADOS,
    horizons,
  });
  const resumo = resumoDaProjecao(projecao);
  const capacidade = capacidadeDeInvestimento({ projecao, expenses: raw.expenses, hoje: today });
  const serie = serieAnual(raw.payments, raw.contracts);
  const cresc = crescimento(serie);
  const conc = concentracao(raw.contracts, raw.payments, today);
  const paradas = rendasParadas(raw.contracts, raw.rentUpdates, raw.coefficients, today);

  const conselhos = construirConselhos({
    snap,
    projecao,
    capacidade,
    resumo,
    concentracao: conc,
    rendasParadas: paradas,
    hoje: today,
  });

  const nomePorFracao = new Map(raw.properties.map((p) => [p.id, nomeDaFracao(p)]));

  const projData: ProjecaoDatum[] = projecao.map((m) => ({
    label: monthLabel(m.mes, m.mes.slice(5, 7) === "01"),
    contratado: m.contratado,
    esperado: m.esperado,
    p10: m.p10,
    banda: m.p90 - m.p10,
  }));

  return (
    <div className="space-y-8">
      <Lede
        title={`Projeção de receitas · ${MESES_PROJETADOS} meses`}
        actions={
          <Link href="/carteira?lente=risco" className="text-sm text-acao hover:underline">
            Ver o risco por fração
          </Link>
        }
      >
        Cenário de receitas ilíquidas · {AMBITO_LABEL[scope]} · de {projecao[0]?.mes.slice(0, 7)} a {projecao.at(-1)?.mes.slice(0, 7)}. Não mede o saldo bancário disponível.
      </Lede>
      <ScopeFilters q={q} landlords={original.raw.landlords} action="/rentabilidade" period={false} search={false} hidden={{ tab: "projecao" }} />
      <div><p className="text-sm text-tinta-2">Receita esperada no cenário de 24 meses</p><div className="mt-2"><Money value={resumo.total} escala="hero" /></div><p className="mt-3 text-sm text-tinta-2">Banda de cenários: {fmtEur(resumo.totalP10)} a {fmtEur(resumo.totalP90)} · {raw.contracts.filter((c) => c.status === "ativo" && (!c.term_kind || c.term_kind === "desconhecido")).length} contratos com prazo desconhecido, mantidos no cenário de continuidade.{scoped.excluded > 0 && ` ${scoped.excluded} imóveis excluídos por quota desconhecida ou fora do âmbito.`}</p></div>
      <details className="text-sm text-tinta-2"><summary className="cursor-pointer text-acao">Como foi calculado</summary><p className="mt-3 max-w-[72ch] leading-relaxed">A projeção multiplica as rendas contratuais pela estimativa de ocorrência de receita, ajustada ao histórico e à média da carteira. A cobertura é específica da fonte de cada contrato. Registos de recibos não confirmam movimentos bancários. Prazos certos documentados usam o fim previsto; prazos desconhecidos assumem continuidade, sem renovação ou novo arrendamento inventados. A banda soma limites individuais e não é um intervalo probabilístico do total. As despesas repetem a média dos últimos 12 meses, incluindo valores espelhados quando identificados. O resultado operacional precede impostos, financiamento e despesas não registadas; não representa dinheiro livre para investir.</p></details>
      {scope === "inteiro" && <Recomendacoes conselhos={conselhos} temAreas={snap.correntes.some((a) => a.property.area_m2)} />}

      <Projecao resumo={resumo} capacidade={capacidade} projData={projData} />

      <Crescimento serie={serie} cresc={cresc} />

      <Concentracao conc={conc} nomePorFracao={nomePorFracao} correntes={snap.correntes.length} />
    </div>
  );
}

// ============================================================

const HORIZONTE_LABEL: Record<Conselho["horizonte"], string> = {
  agora: "este mês",
  ano: "este ano",
  estrutural: "estrutural",
};

/** As recomendações. Mesmo formato de linha da fila do Agora, com o porquê colapsado (R3):
 *  visível fica o quê e quanto, e a aritmética está a um clique para quem duvidar dela.
 *
 *  Não é conselho financeiro e a página diz isso no lede, uma vez, em vez de repetir um
 *  aviso por cartão. */
function Recomendacoes({ conselhos, temAreas }: { conselhos: Conselho[]; temAreas: boolean }) {
  return (
    <Seccao
      titulo="O que a carteira sugere"
      // Uma contagem e não uma soma (2026-10-03): os conselhos medem coisas diferentes (o
      // valor de VENDA de uma fração, a sobra de 24 meses, um ganho anual de renda) e a soma
      // dava "1.080.085 €", um número que não é nada.
      valor={
        conselhos.length > 0 ? (
          <span className="text-xs text-tinta-2">
            {conselhos.length} {conselhos.length === 1 ? "sugestão" : "sugestões"}
          </span>
        ) : undefined
      }
      nota={
        temAreas
          ? undefined
          : "As sugestões de vender ou de subir renda ao nível do mercado precisam da área de cada fração, que ainda não está preenchida. Preenche em Admin e elas aparecem aqui sozinhas."
      }
    >
      {conselhos.length === 0 ? (
        <p className="py-6 text-sm text-tinta-2">
          Nada acima de {fmtEur(250)} por ano. A carteira não está a pedir decisões
          estruturais neste momento.
        </p>
      ) : (
        <ul className="divide-y divide-regua">
          {conselhos.map((c) => (
            <li key={c.kind + (c.subject ?? "")} className="py-3">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[15px] font-medium text-tinta">
                  {c.titulo}
                  <span className="ml-2 align-middle text-[10px] uppercase tracking-[0.04em] text-tinta-3">
                    {HORIZONTE_LABEL[c.horizonte]}
                  </span>
                </p>
                <Money
                  value={c.euros}
                  escala="lg"
                  tom="tinta"
                  className="shrink-0"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {c.acoes.map((a) => (
                  <Link
                    key={a.label}
                    href={a.href}
                    className={buttonClass({ variant: "outline", size: "sm" })}
                  >
                    {a.label}
                  </Link>
                ))}
                <details className="ml-auto text-xs">
                  <summary className="cursor-pointer select-none text-tinta-3 hover:text-tinta-2">
                    porquê
                  </summary>
                  <p className="mt-1.5 max-w-[60ch] text-tinta-2">{c.porque}</p>
                  {c.conta && (
                    <p className="mt-1 text-tinta-3">
                      {c.conta} <Confianca nivel={c.confianca} conta={c.conta} />
                    </p>
                  )}
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Seccao>
  );
}

function Projecao({
  resumo,
  capacidade,
  projData,
}: {
  resumo: ReturnType<typeof resumoDaProjecao>;
  capacidade: ReturnType<typeof capacidadeDeInvestimento>;
  projData: ProjecaoDatum[];
}) {
  return (
    <Seccao
      titulo="Projeção"
      nota="Receitas ilíquidas estimadas. A linha cheia é o esperado no cenário; o tracejado é o contratado. Fins previstos documentados condicionam a continuidade."
    >
      <ProjecaoChart data={projData} />

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-regua pt-4 md:grid-cols-4">
        <Numero
          label="Por mês, em média"
          valor={<Money value={resumo.mediaMensal} escala="lg" />}
          nota="média dos 24 meses projetados"
        />
        <Numero
          label="Renda que expira"
          valor={<Money value={resumo.quedaContratada} escala="lg" tom={resumo.quedaContratada > 0 ? "atencao" : "tinta"} />}
          nota="por mês, no fim do horizonte, sem re-arrendamento assumido"
        />
        <Numero
          label="Despesas"
          valor={
            capacidade.despesasConhecidas ? (
              <Money value={capacidade.despesas24m ?? 0} escala="lg" />
            ) : (
              <Figure value="por saber" escala="lg" tom="futuro" />
            )
          }
          nota={
            capacidade.despesasConhecidas
              ? "projetadas pela média dos últimos 12 meses"
              : "a tabela de despesas está vazia, e a app não as inventa"
          }
        />
        <Numero
          label={capacidade.despesasConhecidas ? "Resultado operacional projetado" : "Receita projetada"}
          valor={
            <Money
              value={capacidade.liquido24m ?? capacidade.receita24m}
              escala="lg"
              tom="acao"
            />
          }
          nota={
            capacidade.despesasConhecidas
              ? `antes de impostos, financiamento e custos desconhecidos${capacidade.despesasEspelhadas ? "; inclui despesas espelhadas estimadas" : ""}`
              : "receita bruta: sem despesas registadas não há líquido"
          }
        />
      </dl>
    </Seccao>
  );
}

function Crescimento({
  serie,
  cresc,
}: {
  serie: ReturnType<typeof serieAnual>;
  cresc: ReturnType<typeof crescimento>;
}) {
  if (serie.length === 0) return null;
  const maximo = Math.max(...serie.map((a) => a.recebido));
  const variacaoPorAno = new Map(cresc.porAno.map((v) => [v.ano, v.variacao]));

  return (
    <Seccao
      titulo="A renda, ano a ano"
      valor={
        cresc.cagr !== null ? (
          <span className="text-xs text-tinta-2">
            {fmtPct(cresc.cagr, 1)} ao ano, em média, entre os anos completos
          </span>
        ) : undefined
      }
    >
      <ul>
        {[...serie].reverse().map((a) => {
          const variacao = variacaoPorAno.get(a.ano) ?? null;
          return (
            <li
              key={a.ano}
              className="flex items-center gap-4 border-b border-regua py-2 last:border-0"
            >
              <span className="w-12 shrink-0 font-mono text-sm text-tinta-2 tabular-nums">
                {a.ano}
              </span>
              {/* Uma barra proporcional em vez de um gráfico: doze linhas não justificam
                  carregar um eixo, e a leitura que interessa e a comparacao entre anos. */}
              <span className="h-2 min-w-0 flex-1 bg-regua/50" aria-hidden="true">
                <span
                  className="block h-full bg-tinta"
                  style={{ width: `${maximo > 0 ? (a.recebido / maximo) * 100 : 0}%` }}
                />
              </span>
              <Money value={a.recebido} escala="sm" className="w-28 shrink-0 text-right" />
              <span
                className={`w-16 shrink-0 text-right text-xs tabular-nums ${
                  variacao === null ? "text-tinta-3" : variacao < 0 ? "text-perda" : "text-tinta-2"
                }`}
              >
                {variacao === null ? "" : `${variacao >= 0 ? "+" : ""}${fmtPct(variacao, 0)}`}
              </span>
              <span className="w-16 shrink-0 text-right text-[11px] text-tinta-3">
                {a.parcial ? "parcial" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </Seccao>
  );
}

function Concentracao({
  conc,
  nomePorFracao,
  correntes,
}: {
  conc: ReturnType<typeof concentracao>;
  nomePorFracao: Map<string, string>;
  correntes: number;
}) {
  if (conc.porInquilino.length === 0) return null;

  // O HHI lê-se mal em bruto. Estes cortes são os da doutrina de concorrência (0.15 e 0.25),
  // que servem aqui pela mesma razão: medem se um mercado depende de poucos participantes.
  const leitura =
    conc.hhi >= 0.25
      ? "muito concentrada"
      : conc.hhi >= 0.15
        ? "concentrada"
        : "dispersa";

  return (
    <Seccao
      titulo="De quem depende a renda"
      nota={
        conc.agrupadosPorNome > 0
          ? `${conc.agrupadosPorNome} ${conc.agrupadosPorNome === 1 ? "inquilino foi agrupado" : "inquilinos foram agrupados"} pelo nome e não pelo NIF, que a base não tem. Dois homónimos apareceriam como um só.`
          : undefined
      }
      valor={
        <span className="text-xs text-tinta-2">
          carteira {leitura} (HHI {conc.hhi.toFixed(2).replace(".", ",")})
        </span>
      }
    >
      <div className="grid gap-8 md:grid-cols-2">
        <Ranking
          titulo="Por inquilino"
          linhas={conc.porInquilino.slice(0, 8).map((l) => ({ ...l, nome: l.nome }))}
          nota={`${conc.porInquilino.length} inquilinos no total`}
        />
        <Ranking
          titulo="Por fração"
          linhas={conc.porFracao
            .slice(0, 8)
            .map((l) => ({ ...l, nome: nomePorFracao.get(l.chave) ?? l.chave }))}
          nota={`${correntes} frações correntes`}
        />
      </div>
    </Seccao>
  );
}

function Ranking({
  titulo,
  linhas,
  nota,
}: {
  titulo: string;
  linhas: Array<{ chave: string; nome: string; recebido12m: number; quota: number }>;
  nota: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-tinta-2">{titulo}</p>
      <ul className="space-y-1.5">
        {linhas.map((l) => (
          <li key={l.chave} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm text-tinta" title={l.nome}>
              {l.nome}
            </span>
            <span className="h-2 min-w-0 flex-1 bg-regua/50" aria-hidden="true">
              <span
                className="block h-full bg-tinta"
                style={{ width: `${Math.min(100, l.quota * 100)}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-tinta-2">
              {fmtPct(l.quota, 0)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-tinta-3">{nota}</p>
    </div>
  );
}

// ============================================================

function Numero({
  label,
  valor,
  nota,
}: {
  label: string;
  valor: React.ReactNode;
  nota: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-[0.06em] text-tinta-3">{label}</dt>
      <dd className="mt-0.5">{valor}</dd>
      <dd className="mt-0.5 text-[11px] leading-snug text-tinta-3">{nota}</dd>
    </div>
  );
}
