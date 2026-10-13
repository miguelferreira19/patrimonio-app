// As decisões: o que fazer, e quanto vale (PLANO.md §4).
//
// Função PURA sobre o Snapshot. Não lê nada novo da BD — se um gerador precisasse de
// dados que o snapshot não tem, era sinal de que faltava no snapshot, não aqui.
//
// ponytail: um array de geradores, não um registo com plugins. Acrescentar um gerador é
// acrescentar uma função a `GERADORES`.

import { reducedRateEligibility, yearsBetween } from "../irs";
import { nomeDaFracao } from "./predios";
import { desalinhamentoDaRenda } from "../rent";
import { fmtDate, fmtEur, fmtPct, mesPorExtenso, monthLabel } from "../format";
import type { Nivel } from "../types";
import type { Snapshot } from "./snapshot";

/** Limiar de materialidade (PLANO.md §2, princípio 5): a app recusa-se a mostrar ruído.
 *  Abaixo disto o sinal é agregado numa linha só, não desaparece. */
export const LIMIAR_ANUAL_EUR = 250;

export type Grupo = "poupar" | "fazer" | "risco" | "saber";

export const GRUPO_LABEL: Record<Grupo, string> = {
  poupar: "Dinheiro a poupar",
  fazer: "A fazer este mês",
  risco: "Risco",
  saber: "Sem informação",
};

export interface Acao {
  label: string;
  href: string;
  externo?: boolean;
}

export interface Insight {
  kind: string;
  /** Entidade a que a decisão respeita, quando há uma. Vazio = carteira inteira, que é o
   *  caso da maioria: os geradores emitem UM item agregado, não um por contrato (foi o
   *  que fez o teste C1 falhar à primeira). Com o `kind` forma a chave do `insight_state`. */
  subject?: string;
  grupo: Grupo;
  /** Verbo no infinitivo: é uma decisão, não um rótulo. */
  titulo: string;
  /** O porquê, com números. Sem isto o item não devia existir. */
  porque: string;
  /** Valor em euros no horizonte de um ano. É o que ordena a fila e soma na linha de topo. */
  euros: number;
  confianca: Nivel;
  /** A aritmética, em texto. Um valor sem conta visível não se mostra (PLANO.md §6.4). */
  conta?: string;
  acoes: Acao[];
}

const PORTAL_RECIBOS =
  "https://imoveis.portaldasfinancas.gov.pt/arrendamento/consultarElementosContratos/locador";

type Gerador = (s: Snapshot) => Insight[];

const GERADORES: Gerador[] = [
  // ---------- A FAZER ----------
  function recibosPorEmitir(s) {
    if (s.recibosPorEmitir.length === 0) return [];
    const total = s.recibosPorEmitir.reduce((a, r) => a + r.contract.rent, 0);
    const n = s.recibosPorEmitir.length;
    return [
      {
        kind: "recibo_por_emitir",
        grupo: "fazer",
        titulo: `Emitir ${n} ${n === 1 ? "recibo" : "recibos"} de ${mesPorExtenso(s.meses[s.meses.length - 1])}`,
        porque: `${n} ${n === 1 ? "contrato ativo" : "contratos ativos"} ainda sem recibo do mês.`,
        euros: total,
        confianca: "medido",
        conta: `Soma das rendas: ${fmtEur(total)}`,
        // Sem "Marcar pagamentos": o registo manual acabou em 2026-07-31, o dinheiro entra
        // todo pelo import do Portal.
        acoes: [{ label: "Abrir Portal das Finanças", href: PORTAL_RECIBOS, externo: true }],
      },
    ];
  },

  function importEmAtraso(s) {
    // A fronteira parada é a causa raiz de dívida falsa: enquanto o mês não é importado,
    // "não pagou" e "ainda não importei" são indistinguíveis.
    if (!s.horizon) return [];
    const mesCorrente = s.meses[s.meses.length - 1];
    const mesesAtras = mesesEntre(s.horizon, mesCorrente);
    if (mesesAtras < 2) return [];
    const emRisco = s.arrears.summary.totalDebt;
    return [
      {
        kind: "import_em_atraso",
        grupo: "fazer",
        titulo: `Importar os recibos (a carteira está ${mesesAtras} meses atrás)`,
        porque: `A app só conhece até ${monthLabel(s.horizon)}. Até importares, todos os atrasos recentes são suspeitos.`,
        euros: emRisco,
        confianca: "medido",
        conta: `${fmtEur(emRisco)} de dívida estimada que o import pode fazer desaparecer`,
        acoes: [{ label: "Importar", href: "/admin" }],
      },
    ];
  },

  // ---------- POUPAR ----------
  function taxaReduzidaArt72(s) {
    // O maior lever da carteira: o quadro 4.2 do Anexo F está vazio nos dois senhorios.
    // Reusa `reducedRateEligibility` do irs.ts. Quota 100: ótica de família, valores por
    // inteiro (a soma das quotas de uma fração é 100, logo isto é o total da família).
    const todos = s.correntes
      .filter((a) => a.activeContract)
      .map((a) => ({
        ativo: a,
        r: reducedRateEligibility(a.activeContract!, a.property.typology, 100, s.hoje),
      }));
    const elegiveis = todos.filter((x) => x.r.eligibleRate !== null && (x.r.annualSavings ?? 0) > 0);
    // A taxa depende do PRAZO do contrato, e 42 não o têm registado (irs.ts). Esses não são
    // poupança, são uma pergunta: quanto valeria SE o prazo for longo, à taxa de 5 anos.
    const porConfirmar = todos.filter((x) => x.r.prazoDesconhecido);
    const itens: Insight[] = [];
    if (elegiveis.length > 0) {
      const n = elegiveis.length;
      itens.push({
        kind: "art72_elegivel",
        grupo: "poupar",
        titulo: `Comunicar ${n} ${n === 1 ? "contrato" : "contratos"} à AT para taxa reduzida do art. 72.º`,
        porque: `${n} de habitação com prazo longo. Podem descer a ${elegiveis
          .map((x) => fmtPct(x.r.eligibleRate ?? 0, 0))
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .join(" ou ")}.`,
        euros: elegiveis.reduce((acc, x) => acc + (x.r.annualSavings ?? 0), 0),
        confianca: "estimado",
        conta: `(taxa autónoma − taxa reduzida) × renda anual, por contrato. Exige comunicação à AT (Portaria 110/2019).`,
        acoes: [{ label: "Ver no IRS", href: "/relatorios?tab=irs" }],
      });
    }
    if (porConfirmar.length > 0) {
      const n = porConfirmar.length;
      const ate = porConfirmar.reduce((acc, x) => acc + 0.13 * x.ativo.activeContract!.rent * 12, 0);
      itens.push({
        kind: "art72_prazo",
        grupo: "saber",
        titulo: `Confirmar o prazo de ${n} ${n === 1 ? "contrato longo" : "contratos longos"} (art. 72.º)`,
        porque: `Habitação com 5 ou mais anos de casa e sem prazo registado. Se o prazo for de 5+ anos, a taxa desce.`,
        euros: ate,
        confianca: "assumido",
        conta: `Até (28% − 15%) × renda anual, só se o prazo do contrato for de 5 anos ou mais.`,
        acoes: [{ label: "Ver contratos", href: "/contratos?estado=desconhecido" }],
      });
    }
    return itens;
  },

  function atualizacaoDeRenda(s) {
    const elegiveis = s.correntes.filter(
      (a) =>
        a.activeContract &&
        a.rendaAtualizavel?.eligible &&
        (a.rendaAtualizavel.suggestedRent ?? 0) > a.activeContract.rent,
    );
    if (elegiveis.length === 0) return [];
    const total = elegiveis.reduce(
      (acc, a) => acc + ((a.rendaAtualizavel!.suggestedRent ?? 0) - a.activeContract!.rent) * 12,
      0,
    );
    const n = elegiveis.length;
    return [
      {
        kind: "atualizacao_renda",
        grupo: "poupar",
        titulo: `Atualizar ${n} ${n === 1 ? "renda" : "rendas"} pelo coeficiente anual`,
        porque:
          n === 1
            ? `${nomeDaFracao(elegiveis[0].property)} é atualizável desde ${monthLabel(
                (elegiveis[0].rendaAtualizavel!.eligibleSince ?? s.hoje).slice(0, 7) + "-01",
              )}.`
            : `${n} contratos passaram os 12 meses desde a última atualização. Cada ano que não se atualiza compõe.`,
        euros: total,
        confianca: "medido",
        conta: `Σ (renda sugerida − renda atual) × 12 = ${fmtEur(total)}/ano`,
        acoes: elegiveis
          .slice(0, 1)
          .map((a) => ({ label: "Gerar carta", href: `/carta/${a.activeContract!.id}` }))
          .concat([{ label: "Ver imóveis", href: "/imoveis?f=atualizavel" }]),
      },
    ];
  },

  function vazios(s) {
    // Frações correntes sem contrato (11 de 53 a 13/10/2026). Não havia alerta nenhum: a
    // lente Vazios da Carteira era o único sítio onde se viam. O valor é a última renda
    // que a fração teve; sem contrato anterior, a mediana do INE × área; sem as duas, a
    // fração aparece mas não soma (não se inventa uma renda).
    const linhas = s.correntes
      .filter((a) => !a.activeContract)
      .map((a) => {
        const ultima = a.contracts[0]?.rent ?? null;
        const mercado =
          a.mercado.benchmarkRentM2 !== null && a.property.area_m2 ? a.mercado.benchmarkRentM2 * a.property.area_m2 : null;
        const desde = a.vazios.find((g) => g.gapEnd === null)?.gapStart ?? null;
        return { ativo: a, renda: ultima ?? mercado, estimada: ultima === null && mercado !== null, desde };
      })
      .sort((x, y) => (y.renda ?? 0) - (x.renda ?? 0));
    if (linhas.length === 0) return [];
    const n = linhas.length;
    const total = linhas.reduce((acc, l) => acc + (l.renda ?? 0) * 12, 0);
    return [
      {
        kind: "vazios",
        grupo: "poupar",
        titulo: `Arrendar ${n} ${n === 1 ? "fração vazia" : "frações vazias"}`,
        porque: linhas
          .slice(0, 3)
          .map((l) => `${nomeDaFracao(l.ativo.property)}${l.desde ? ` (desde ${monthLabel(l.desde.slice(0, 7) + "-01")})` : ""}`)
          .join(", "),
        euros: total,
        confianca: linhas.some((l) => l.estimada || l.renda === null) ? "estimado" : "medido",
        conta: `Σ última renda de cada fração × 12; sem contrato anterior, mediana INE × área. ${linhas.filter((l) => l.renda === null).length} sem valor de referência, fora da soma.`,
        acoes: [{ label: "Ver vagas", href: "/imoveis?f=vagas" }],
      },
    ];
  },

  function rendaAbaixoDoMercado(s) {
    const total = s.mercado.potencialMes * 12;
    if (s.mercado.abaixo.length === 0 || total <= 0) return [];
    const pior = s.mercado.abaixo[0];
    return [
      {
        kind: "renda_abaixo_mercado",
        grupo: "poupar",
        titulo: `${s.mercado.abaixo.length} ${s.mercado.abaixo.length === 1 ? "renda abaixo" : "rendas abaixo"} do mercado (na mudança de inquilino)`,
        porque: `A pior é ${nomeDaFracao(pior.property)}, ${fmtPct(pior.mercado.deviation ?? 0, 0)} face à mediana INE. Só se capta quando a fração muda de inquilino.`,
        euros: total,
        // ASSUMIDO, e por isso fora do número de topo (2026-10-03): a mediana é de NOVOS
        // contratos e a um inquilino em casa só se aplica o coeficiente anual. Somar isto a
        // "a ganhar este ano" prometia 46.833 € que nenhuma decisão deste ano capta.
        confianca: "assumido",
        conta: `${fmtEur(s.mercado.potencialMes)}/mês × 12. Mediana INE de NOVOS contratos: não é o que se pode exigir a um contrato em vigor.`,
        acoes: [{ label: "Ver mercado", href: "/mercado" }],
      },
    ];
  },

  function rendaErrada(s) {
    // Renda registada abaixo do que os recibos repetem: dinheiro que a app está a
    // subestimar em TODO o sítio (esperado, atrasos, IRS, mercado). Foi encontrado nos
    // dados reais em 2026-07-25 em dois contratos, 267 EUR/mês ao todo.
    const erradas = s.correntes
      .filter((a) => a.activeContract)
      .map((a) => ({
        ativo: a,
        obs: s.rendaObservadaPorContrato[a.activeContract!.id],
        d: desalinhamentoDaRenda(
          a.activeContract!.rent,
          s.rendaObservadaPorContrato[a.activeContract!.id] ?? null,
        ),
      }))
      .filter((x) => x.d?.direcao === "baixa");
    if (erradas.length === 0) return [];

    const porMes = erradas.reduce((acc, x) => acc + (x.d?.diferenca ?? 0), 0);
    const n = erradas.length;
    return [
      {
        kind: "renda_errada",
        grupo: "poupar",
        titulo: `Corrigir ${n} ${n === 1 ? "renda registada abaixo" : "rendas registadas abaixo"} do que os recibos mostram`,
        porque: erradas
          .map((x) => `${nomeDaFracao(x.ativo.property)}: ${fmtEur(x.ativo.activeContract!.rent)} registados, ${fmtEur(x.obs!.valor)} nos recibos`)
          .join("; ") + ".",
        euros: porMes * 12,
        confianca: "medido",
        conta: `${fmtEur(porMes)}/mês × 12. Causa típica: a renda foi inferida de um mês com apenas parte dos recibos emitidos.`,
        acoes: [{ label: "Ver na Saúde dos dados", href: "/saude" }],
      },
    ];
  },

  // ---------- RISCO ----------
  function atrasos(s) {
    // UM item, não um por contrato. Com 18 contratos em atraso, um item por contrato
    // enchia a fila de 20 linhas e ela deixava de ser uma priorização — era o risco C1 do
    // PLANO.md ("a fila torna-se um segundo inbox que ninguém esvazia"), e com os dados
    // reais aconteceu logo à primeira. O detalhe contrato a contrato já vive em /atrasos:
    // a fila diz que há dinheiro a cobrar e quanto, a página diz de quem.
    const emAtraso = emAtrasoDaCarteira(s);
    if (emAtraso.length === 0) return [];
    const divida = emAtraso.reduce((acc, r) => acc + r.debt, 0);

    // O valor é a dívida, com o MESMO nome e número do cartão do mês e da Cobranças
    // (PLANO_CLAREZA.md 1.6). Era a perda esperada (Fase 4): um terceiro número para a mesma
    // pergunta, ao lado de "saldo inferido" e "em dívida", e a família deixou de saber quanto
    // estava em atraso. A perda esperada continua no risk.ts para quem a quiser ler.
    const n = emAtraso.length;
    const piores = emAtraso.slice(0, 3).map((r) => {
      const prop = s.ativos.find((a) => a.property.id === r.propertyId)?.property;
      const nome = prop ? nomeDaFracao(prop) : "fração";
      return `${nome} (${fmtEur(r.debt)})`;
    });
    return [
      {
        kind: "atraso",
        grupo: "risco",
        titulo: `Cobrar ${n} ${n === 1 ? "contrato" : "contratos"} em atraso`,
        porque:
          `Meses anteriores sem recibo emitido. ` +
          `Maiores: ${piores.join(", ")}${n > 3 ? `, e outros ${n - 3}` : ""}.`,
        euros: divida,
        confianca: "medido",
        conta:
          "Meses em atraso × renda habitual (líquida de retenção), até 24 meses por contrato. " +
          "Um mês conta quando termina sem recibo emitido; renda paga sem recibo regista-se no extrato.",
        acoes: [{ label: "Ver quem deve", href: "/cobrancas" }],
      },
    ];
  },

  function contratosZombie(s) {
    const zombies = s.arrears.rows.filter((r) => r.stale);
    if (zombies.length === 0) return [];
    const n = zombies.length;
    return [
      {
        kind: "contrato_zombie",
        grupo: "risco",
        titulo: `Confirmar se ${n} ${n === 1 ? "contrato cessou" : "contratos cessaram"}`,
        porque: `Sem recibos há mais de 12 meses. Enquanto ficarem "ativos", poluem todas as métricas de cobrança.`,
        // Não vale dinheiro a receber: vale limpar dívida que provavelmente não existe.
        euros: zombies.reduce((a, r) => a + r.expectedRent * 12, 0),
        confianca: "assumido",
        conta: `Renda de referência × 12 dos contratos parados. Se cessaram, este valor sai das métricas; se não, é dívida real.`,
        acoes: zombies
          .slice(0, 1)
          .map((r) => ({ label: "Ver fração", href: `/fracoes/${r.propertyId}` })),
      },
    ];
  },

  function contratosATerminar(s) {
    if (s.contratosATerminar.length === 0) return [];
    const n = s.contratosATerminar.length;
    const total = s.contratosATerminar.reduce((a, c) => a + c.contract.rent * 12, 0);
    return [
      {
        kind: "contrato_a_terminar",
        grupo: "risco",
        titulo: `Decidir ${n} ${n === 1 ? "contrato que termina" : "contratos que terminam"} nos próximos 90 dias`,
        porque: s.contratosATerminar
          .slice(0, 3)
          .map((c) => `${c.property ? nomeDaFracao(c.property) : "?"} (${c.contract.end_date})`)
          .join(", "),
        euros: total,
        confianca: "medido",
        conta: `Renda anual em jogo: ${fmtEur(total)}. Prazos legais de denúncia não são calculados: confirmar caso a caso.`,
        acoes: [{ label: "Ver imóveis", href: "/imoveis?f=atualizavel" }],
      },
    ];
  },

  // ---------- POR SABER ----------
  function fontesParadas(s) {
    // Um senhorio deixou de emitir (o avô, desde 27/07/2026). Os contratos dele não estão em
    // atraso, estão por saber: a app pára a fronteira deles na última emissão. Isto é o
    // lembrete de que esses meses existem e que alguém tem de os passar (os herdeiros).
    return s.fontes
      .filter((f) => f.parada && f.contratos > 0)
      .map((f) => {
        // Até à fronteira GLOBAL (o último mês que as outras fontes já cobrem), e não até ao
        // mês corrente: esse ainda está em carência para toda a gente.
        const meses = Math.max(1, mesesEntre(f.horizonte, s.horizon ?? f.horizonte));
        const euros = f.renda * meses;
        return {
          kind: "fonte_parada",
          subject: f.landlord.id,
          grupo: "saber" as const,
          titulo: `Recibos de ${f.landlord.name} parados desde ${mesPorExtenso(f.horizonte, true)}`,
          porque: `${f.contratos} ${f.contratos === 1 ? "contrato" : "contratos"} sem recibo emitido depois de ${fmtDate(f.ultimaEmissao)}. Esses meses ficam sem informação, não em atraso, até os recibos serem emitidos.`,
          euros,
          confianca: "assumido" as const,
          conta: `${fmtEur(f.renda)}/mês × ${meses} ${meses === 1 ? "mês" : "meses"} de rendas sem recibo.`,
          acoes: [{ label: "Ver contratos", href: "/cobrancas#sem-informacao" }],
        };
      });
  },

  function fichasIncompletas(s) {
    const incompletas = s.correntes.filter((a) => a.fichaEmFalta.length > 0);
    if (incompletas.length === 0) return [];
    // Valor da informação: o que estas fichas DESBLOQUEIAM. Sem tipologia, o art. 72.º
    // fica "a confirmar" para sempre; a poupança máxima é a do escalão mais alto (28→15%)
    // nos contratos que já têm duração para isso.
    const semTipologia = incompletas.filter(
      (a) => a.activeContract && a.fichaEmFalta.includes("tipologia"),
    );
    const desbloqueia = semTipologia.reduce((acc, a) => {
      const anos = yearsBetween(a.activeContract!.start_date ?? s.hoje, s.hoje);
      if (anos === null || anos < 5) return acc;
      return acc + 0.13 * a.activeContract!.rent * 12;
    }, 0);
    return [
      {
        kind: "ficha_incompleta",
        grupo: "saber",
        titulo: `Preencher ${incompletas.length} ${incompletas.length === 1 ? "ficha" : "fichas"} de fração`,
        porque: `Em falta: ${resumirCampos(incompletas.flatMap((a) => a.fichaEmFalta))}. Sem isto não há €/m² vs mercado nem elegibilidade ao art. 72.º.`,
        euros: desbloqueia,
        confianca: "assumido",
        conta:
          desbloqueia > 0
            ? `Até ${fmtEur(desbloqueia)}/ano: (28% − 15%) × renda anual dos ${semTipologia.length} contratos sem tipologia com 5+ anos. Assume uso habitacional, que é o que falta confirmar.`
            : "Nenhum contrato sem tipologia atinge os 5 anos: o valor está em €/m² e valor de mercado, que não são quantificáveis sem a área.",
        acoes: [{ label: "Ver o que falta", href: "/saude" }],
      },
    ];
  },
];

export interface Fila {
  /** Itens acima do limiar, ordenados por valor. */
  itens: Insight[];
  /** Quantos ficaram abaixo do limiar de materialidade, e quanto valiam ao todo. */
  residuais: { n: number; euros: number };
  /** Soma dos itens medidos e estimados, fora o grupo "fazer". É a linha de dinheiro do
   *  topo ("a ganhar este ano"): emitir os recibos do mês é uma obrigação, não um ganho, e
   *  somava a renda inteira do mês a esse número. */
  total: number;
  /** Soma dos itens `assumido`, à parte: dependem de uma premissa que a app não confirma
   *  (PLANO.md §12, risco C3 — nunca somar premissas ao número de topo). */
  totalAssumido: number;
  /** Adiadas e dispensadas, com a data. Não entram em `itens` nem em `total`, mas são
   *  mostradas dobradas no fim: uma decisão escondida sem rasto é uma decisão perdida. */
  silenciadas: Array<{ item: Insight; ate: string | null; dispensada: boolean }>;
}

/** Chave de um insight no `insight_state`. */
export function chaveInsight(i: Pick<Insight, "kind" | "subject">): string {
  return `${i.kind}:${i.subject ?? ""}`;
}

/** Os contratos em atraso da carteira: dívida acima de zero, fora os de "ritmo próprio".
 *  UMA definição, partilhada pela tarefa "Cobrar" e pelo cartão do mês (mes.ts), para os
 *  dois nunca mostrarem números diferentes (V4, 2026-10-09). */
export function emAtrasoDaCarteira(s: Pick<Snapshot, "arrears">) {
  return s.arrears.rows
    .filter((r) => r.debt > 0 && r.severity !== "ritmo_proprio")
    .sort((a, b) => b.debt - a.debt);
}

export function construirFila(s: Snapshot): Fila {
  const todos = GERADORES.flatMap((g) => g(s));

  // S3: um item adiado até uma data futura, ou dispensado, sai da fila. O gerador correu
  // na mesma — isto decide o que se MOSTRA, nunca o que é verdade.
  const estado = new Map(s.insightState.map((e) => [`${e.kind}:${e.subject}`, e]));
  const silenciadas: Fila["silenciadas"] = [];
  const visiveis: Insight[] = [];
  for (const i of todos) {
    const e = estado.get(chaveInsight(i));
    const adiado = e?.snoozed_until != null && e.snoozed_until >= s.hoje;
    const dispensado = e?.dismissed_at != null;
    if (adiado || dispensado) {
      silenciadas.push({ item: i, ate: e?.snoozed_until ?? null, dispensada: dispensado });
    } else {
      visiveis.push(i);
    }
  }

  const itens = visiveis
    .filter((i) => i.euros >= LIMIAR_ANUAL_EUR)
    .sort((a, b) => b.euros - a.euros);
  const abaixo = visiveis.filter((i) => i.euros < LIMIAR_ANUAL_EUR);
  return {
    itens,
    residuais: { n: abaixo.length, euros: abaixo.reduce((a, i) => a + i.euros, 0) },
    total: itens
      .filter((i) => i.confianca !== "assumido" && i.grupo !== "fazer")
      .reduce((a, i) => a + i.euros, 0),
    totalAssumido: itens.filter((i) => i.confianca === "assumido").reduce((a, i) => a + i.euros, 0),
    silenciadas: silenciadas.sort((a, b) => b.item.euros - a.item.euros),
  };
}

export function agrupar(itens: Insight[]): Array<{ grupo: Grupo; itens: Insight[]; euros: number }> {
  // O RISCO primeiro (pedido do utilizador, 2026-07-30). Perder uma renda que já está
  // contratada custa mais do que ganhar uma poupança que ainda não existe, e era o risco
  // que estava em terceiro lugar, a seguir a duas secções de oportunidades.
  const ordem: Grupo[] = ["risco", "poupar", "fazer", "saber"];
  return ordem
    .map((grupo) => {
      const doGrupo = itens.filter((i) => i.grupo === grupo);
      return { grupo, itens: doGrupo, euros: doGrupo.reduce((a, i) => a + i.euros, 0) };
    })
    .filter((g) => g.itens.length > 0);
}

function mesesEntre(a: string, b: string): number {
  const ya = parseInt(a.slice(0, 4), 10);
  const ma = parseInt(a.slice(5, 7), 10);
  const yb = parseInt(b.slice(0, 4), 10);
  const mb = parseInt(b.slice(5, 7), 10);
  return (yb - ya) * 12 + (mb - ma);
}

function resumirCampos(campos: string[]): string {
  const contagem = new Map<string, number>();
  for (const c of campos) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  return Array.from(contagem.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([campo, n]) => `${campo} (${n})`)
    .join(", ");
}
