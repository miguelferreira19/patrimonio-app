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
import { ProjecaoChart, type ProjecaoDatum } from "@/components/charts";
import { Confianca, Figure, Lede, Money } from "@/components/kit";
import { buttonClass } from "@/components/ui";
import { getSession } from "@/lib/data";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { construirConselhos, type Conselho } from "@/lib/portfolio/conselhos";
import { capacidadeDeInvestimento, projetar, resumoDaProjecao } from "@/lib/portfolio/futuro";
import { concentracao, crescimento, rendasParadas, serieAnual } from "@/lib/portfolio/renda";
import { fmtEur, fmtPct, monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

const MESES_PROJETADOS = 24;

export default async function AnalisePage() {
  const { isAdmin } = await getSession();
  if (!isAdmin) redirect("/");

  const { raw, snap, today } = await getSnapshotComRaw();

  const projecao = projetar({
    contracts: raw.contracts,
    payments: raw.payments,
    hoje: today,
    meses: MESES_PROJETADOS,
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

  const nomePorFracao = new Map(raw.properties.map((p) => [p.id, p.name]));

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
        eyebrow={`Próximos ${MESES_PROJETADOS} meses`}
        title={<Money value={resumo.total} escala="hero" />}
        actions={
          <Link href="/carteira?lente=risco" className="text-sm text-acao hover:underline">
            Ver o risco por fração
          </Link>
        }
      >
        Receita esperada, entre {fmtEur(resumo.totalP10)} e {fmtEur(resumo.totalP90)}. É uma
        simulação a partir dos teus próprios dados, não um conselho de investimento.
      </Lede>

      <Recomendacoes conselhos={conselhos} temAreas={snap.correntes.some((a) => a.property.area_m2)} />

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
      valor={
        conselhos.length > 0 ? (
          <Money value={conselhos.reduce((acc, c) => acc + c.euros, 0)} escala="sm" tom="tinta-2" />
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
                  tom={c.grupo === "risco" ? "perda" : "acao"}
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
      nota="A linha cheia é o esperado, o tracejado é o contratado. A distância entre os dois é o risco de crédito; a queda do tracejado são contratos a expirar."
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
          label={capacidade.despesasConhecidas ? "Sobra em 24 meses" : "Entra em 24 meses"}
          valor={
            <Money
              value={capacidade.liquido24m ?? capacidade.receita24m}
              escala="lg"
              tom="acao"
            />
          }
          nota={
            capacidade.despesasConhecidas
              ? "líquido, o que fica para investir"
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
          carteira {leitura} (HHI {conc.hhi.toFixed(2)})
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

/** R2: agrupar é uma hairline e uma etiqueta, não um cartão. A `nota` é a única prosa
 *  permitida, e vive no cabeçalho, nunca por baixo de um gráfico (R4). */
function Seccao({
  titulo,
  nota,
  valor,
  children,
}: {
  titulo: string;
  nota?: string;
  valor?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-3 border-b border-regua pb-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">
            {titulo}
          </h2>
          {valor}
        </div>
        {nota && <p className="mt-1 max-w-[75ch] text-xs text-tinta-3">{nota}</p>}
      </header>
      {children}
    </section>
  );
}

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
