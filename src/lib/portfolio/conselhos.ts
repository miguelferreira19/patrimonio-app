// Conselhos: a lista da superfície `/analise` (V3, Fase F5, ver V3.md).
//
// DECISÃO DE ARQUITETURA: isto NÃO é a fila do Agora. `insights.ts` continua a ser o único
// dono do ritual mensal (`GERADORES`, `Grupo`, `GRUPO_LABEL`) e fica intocado — este
// módulo só reusa o TIPO `Insight` (a forma de uma decisão com preço em euros) para uma
// lista SEPARADA, mais estrutural e menos urgente, que vive em `/analise`.
//
// Módulo PURO: sem I/O, sem React, sem `new Date()` escondido — o relógio (`hoje`) entra
// por parâmetro dentro de `EntradaConselhos`, embora hoje nenhum gerador precise dele
// diretamente (todas as datas já vieram calculadas em `projecao`/`resumo`/`concentracao`).
//
// REGRA: nada de regra de negócio nova aqui além da agregação e da leitura dos motores que
// já existem (`renda.ts`, `futuro.ts`, `snapshot.ts`, `calc.ts`). Os geradores 6 e 7
// (`yieldBaixo`, `candidatoAVenda`) dependem de `area_m2`, hoje por preencher em quase toda
// a carteira (V3.md) — ficam corretos e devolvem `[]` até as fichas serem preenchidas, sem
// inventar um fallback a partir do VPT (decisão explícita do utilizador).

import { SEVERITY_LABEL } from "../arrears";
import { fmtEur, fmtPct } from "../format";
import type { Grupo, Insight } from "./insights";
import type { CapacidadeDeInvestimento, MesProjetado, ResumoDaProjecao } from "./futuro";
import type { Concentracao, RendaParada } from "./renda";
import type { Snapshot } from "./snapshot";

/** Limiar de materialidade: o mesmo valor e o mesmo princípio de `LIMIAR_ANUAL_EUR` em
 *  `insights.ts` (PLANO.md §2, princípio 5) — abaixo disto o sinal não se mostra sozinho.
 *  Nome próprio porque este módulo não importa `insights.ts` em runtime, só o tipo. */
export const LIMIAR_CONSELHO_EUR = 250;

/** Um conselho é um `Insight` com um horizonte temporal: `agora` já é acionável hoje,
 *  `ano` é o que se resolve dentro do ano corrente, `estrutural` é o que muda o perfil da
 *  carteira e não tem prazo natural. Serve para agrupar a UI de `/analise` sem reusar o
 *  `Grupo` do Agora (que responde a outra pergunta: "que tipo de ação é").*/
export type Conselho = Insight & { horizonte: "agora" | "ano" | "estrutural" };

export interface EntradaConselhos {
  snap: Snapshot;
  projecao: MesProjetado[];
  capacidade: CapacidadeDeInvestimento;
  resumo: ResumoDaProjecao;
  concentracao: Concentracao;
  rendasParadas: RendaParada[];
  hoje: Date;
}

type GeradorConselho = (e: EntradaConselhos) => Conselho[];

const GERADORES: GeradorConselho[] = [
  // ---------- DISPONÍVEIS JÁ ----------

  function concentracaoInquilino(e) {
    const top = e.concentracao.porInquilino[0];
    if (!top || top.quota <= 0.15) return [];

    // ARMADILHA DO INQUILINO (V3.md): sem NIF, o grupo é por nome normalizado e pode
    // juntar homónimos. `agrupadosPorNome` é o sinal dessa incerteza na carteira inteira;
    // aqui só se aplica quando o PRÓPRIO grupo do topo veio de nome, não de NIF.
    const porNome = top.chave.startsWith("nome:");
    const conta = porNome
      ? `${fmtEur(top.recebido12m)} recebidos nos últimos 12 meses de "${top.nome}", ${fmtPct(top.quota, 0)} do total da carteira. Agrupado por NOME, sem NIF: ${e.concentracao.agrupadosPorNome} ${e.concentracao.agrupadosPorNome === 1 ? "grupo da carteira juntou-se assim" : "grupos da carteira juntaram-se assim"} e podem confundir homónimos.`
      : `${fmtEur(top.recebido12m)} recebidos nos últimos 12 meses de "${top.nome}", ${fmtPct(top.quota, 0)} do total da carteira. Agrupado por NIF.`;

    return [
      {
        kind: "concentracao_inquilino",
        subject: top.chave,
        grupo: "risco",
        horizonte: "estrutural",
        titulo: `Reduzir a exposição a "${top.nome}"`,
        porque: `Um só inquilino representa ${fmtPct(top.quota, 0)} da receita dos últimos 12 meses.`,
        euros: top.recebido12m,
        confianca: porNome ? "estimado" : "medido",
        conta,
        acoes: [{ label: "Ver risco", href: "/carteira?lente=risco" }],
      },
    ];
  },

  function rendaParadaAgregada(e) {
    if (e.rendasParadas.length === 0) return [];
    const total = e.rendasParadas.reduce((acc, r) => acc + r.ganhoAnual, 0);
    if (total <= 0) return [];

    const n = e.rendasParadas.length;
    const piores = e.rendasParadas
      .slice(0, 3)
      .map((r) => `${r.tenant} (${fmtEur(r.ganhoAnual)}/ano, ${r.mesesSemAtualizar} meses parada)`);
    return [
      {
        kind: "renda_parada",
        grupo: "poupar",
        horizonte: "ano",
        titulo: `Atualizar ${n} ${n === 1 ? "renda parada" : "rendas paradas"} há mais de 24 meses`,
        porque: `Maiores: ${piores.join(", ")}${n > 3 ? `, e outras ${n - 3}` : ""}.`,
        euros: total,
        confianca: "estimado",
        conta: `Σ (renda sugerida − renda atual) × 12, por contrato parado, = ${fmtEur(total)}/ano.`,
        acoes: [{ label: "Ver rendas", href: "/carteira?lente=renda" }],
      },
    ];
  },

  function fimDeContrato(e) {
    const lista = e.snap.contratosATerminar;
    if (lista.length === 0) return [];

    const n = lista.length;
    const total = lista.reduce((acc, c) => acc + c.contract.rent * 12, 0);
    return [
      {
        kind: "fim_de_contrato",
        grupo: "risco",
        horizonte: "agora",
        titulo: `Decidir ${n} ${n === 1 ? "contrato que termina" : "contratos que terminam"} em breve`,
        porque:
          lista
            .slice(0, 3)
            .map((c) => `${c.property?.name ?? "fração"} (${c.contract.end_date})`)
            .join(", ") + (n > 3 ? `, e outros ${n - 3}` : "") + ".",
        euros: total,
        confianca: "medido",
        conta: `Σ renda anual dos contratos que terminam = ${fmtEur(total)}.`,
        acoes: [{ label: "Ver vazios", href: "/carteira?lente=vazios" }],
      },
    ];
  },

  function capacidadeDeInvestir(e) {
    const { capacidade, projecao } = e;
    const euros = capacidade.despesasConhecidas ? capacidade.liquido24m! : capacidade.receita24m;
    if (euros <= 0) return [];

    const horizonteMeses = projecao.length;
    // HONESTIDADE OBRIGATÓRIA (V3.md, futuro.ts): sem despesas conhecidas, a app tem de
    // dizer às claras que o número é receita bruta, nunca disfarçar de "líquido".
    const espelhadas = capacidade.despesasEspelhadas
      ? " Parte da despesa é ESPELHADA de um comproprietário (não foi medida neste senhorio)."
      : "";
    const conta = capacidade.despesasConhecidas
      ? `Receita esperada (${fmtEur(capacidade.receita24m)}) menos despesa média mensal projetada (${fmtEur(capacidade.despesas24m!)}) ao longo de ${horizonteMeses} meses = líquido ${fmtEur(capacidade.liquido24m!)}.${espelhadas}`
      : `${fmtEur(capacidade.receita24m)} de receita ESPERADA nos próximos ${horizonteMeses} meses. É receita BRUTA: a tabela de despesas não tem registos suficientes (menos de 3 nos últimos 12 meses) para calcular um líquido credível.`;

    return [
      {
        kind: "capacidade_investir",
        grupo: "poupar",
        horizonte: "estrutural",
        titulo: "Planear a aplicação da capacidade de investimento",
        porque: capacidade.despesasConhecidas
          ? `A carteira liberta ${fmtEur(capacidade.liquido24m!)} líquidos nos próximos ${horizonteMeses} meses.`
          : `A carteira espera receber ${fmtEur(capacidade.receita24m)} nos próximos ${horizonteMeses} meses; não há despesas suficientes registadas para calcular o líquido.`,
        euros,
        // Despesa espelhada volta a descer a confiança para "assumido": o líquido deixa
        // de ser uma média de factos e passa a incluir a conta de outra pessoa.
        confianca:
          capacidade.despesasConhecidas && !capacidade.despesasEspelhadas ? "estimado" : "assumido",
        conta,
        // Sem ação: este conselho VIVE na /analise, e um botão "Ver projeção" na página
        // que já mostra a projeção é ruído. Quando houver despesas registadas, a ação
        // natural é o Ano, não esta página.
        acoes: capacidade.despesasConhecidas
          ? [{ label: "Ver despesas do ano", href: `/ano/${e.hoje.getFullYear()}#despesas` }]
          : [{ label: "Registar despesas", href: `/ano/${e.hoje.getFullYear()}#despesas` }],
      },
    ];
  },

  function rendaAExpirar(e) {
    const { resumo, projecao } = e;
    if (resumo.quedaContratada <= 0) return [];

    const euros = resumo.quedaContratada * 12;
    return [
      {
        kind: "renda_a_expirar",
        grupo: "risco",
        horizonte: "ano",
        titulo: "Rever a renda contratada que expira sem renovação assumida",
        porque: `A renda contratada cai ${fmtEur(resumo.quedaContratada)}/mês entre o início e o fim dos próximos ${projecao.length} meses, sem nenhum rearrendamento assumido.`,
        euros,
        confianca: "estimado",
        conta: `${fmtEur(resumo.quedaContratada)}/mês × 12 = ${fmtEur(euros)}/ano.`,
        acoes: [{ label: "Ver rendas", href: "/carteira?lente=renda" }],
      },
    ];
  },

  // ---------- BLOQUEADOS NAS ÁREAS (devolvem [] até `area_m2` estar preenchida) ----------

  function yieldBaixo(e) {
    const comYield = e.snap.correntes.filter((a) => a.mercado.grossYield !== null);
    // Uma mediana de um ponto só não compara nada: exige pelo menos dois yields conhecidos.
    if (comYield.length < 2) return [];

    const med = mediana(comYield.map((a) => a.mercado.grossYield!));
    if (med <= 0) return [];
    const limiar = med * 0.7;

    const out: Conselho[] = [];
    for (const a of comYield) {
      const y = a.mercado.grossYield!;
      if (y >= limiar) continue;
      const valor = a.mercado.estimatedValue;
      if (valor === null) continue; // sem valor estimado nao ha euros para mostrar
      const ganho = valor * (med - y);
      if (ganho <= 0) continue;

      out.push({
        kind: "yield_baixo",
        subject: a.property.id,
        grupo: "poupar",
        horizonte: "estrutural",
        titulo: `Rever o yield de ${a.property.name}`,
        porque: `${a.property.name} rende ${fmtPct(y, 1)} ao ano sobre o valor estimado, abaixo dos ${fmtPct(limiar, 1)} (70% da mediana da carteira, ${fmtPct(med, 1)}, sobre ${comYield.length} frações com área conhecida).`,
        euros: ganho,
        confianca: "estimado",
        conta: `(mediana ${fmtPct(med, 1)} − yield atual ${fmtPct(y, 1)}) × valor estimado ${fmtEur(valor)} = ${fmtEur(ganho)}/ano.`,
        acoes: [{ label: "Ver mercado", href: "/mercado" }],
      });
    }
    return out;
  },

  function candidatoAVenda(e) {
    const comYield = e.snap.correntes.filter((a) => a.mercado.grossYield !== null);
    // Um quartil com poucos pontos não diz nada: exige uma amostra mínima.
    if (comYield.length < 4) return [];
    const corte = quartil25(comYield.map((a) => a.mercado.grossYield!));

    const out: Conselho[] = [];
    for (const a of comYield) {
      const y = a.mercado.grossYield!;
      if (y > corte) continue;
      const emAtraso = a.arrears !== null && a.arrears.severity !== "ok" && a.arrears.severity !== "ritmo_proprio";
      if (!emAtraso) continue;
      const valor = a.mercado.estimatedValue;
      if (valor === null || valor <= 0) continue;

      out.push({
        kind: "candidato_venda",
        subject: a.property.id,
        grupo: "risco",
        horizonte: "estrutural",
        titulo: `Considerar vender ${a.property.name}`,
        porque: `${a.property.name} está no quartil inferior de yield da carteira (${fmtPct(y, 1)}, corte ${fmtPct(corte, 1)}) e tem histórico de atraso (${SEVERITY_LABEL[a.arrears!.severity]}).`,
        euros: valor,
        confianca: "estimado",
        conta: `Valor estimado da fração (área × mediana de venda INE) = ${fmtEur(valor)}. É uma SIMULAÇÃO a partir dos dados da própria carteira, não uma recomendação de investimento.`,
        acoes: [{ label: "Ver fração", href: `/fracoes/${a.property.id}` }],
      });
    }
    return out;
  },
];

/**
 * Constrói a lista de conselhos de `/analise`: corre todos os geradores, aplica o limiar
 * de materialidade e ordena por euros decrescente. Ao contrário de `construirFila` em
 * `insights.ts`, não há estado de adiar/dispensar aqui — os conselhos são estruturais, não
 * um ritual mensal com fila a esvaziar.
 */
export function construirConselhos(entrada: EntradaConselhos): Conselho[] {
  const todos = GERADORES.flatMap((g) => g(entrada));
  return todos.filter((c) => c.euros >= LIMIAR_CONSELHO_EUR).sort((a, b) => b.euros - a.euros);
}

// ---------------------------------------------------------------------------
// Utilitários locais (estatística simples, não regra de negócio)
// ---------------------------------------------------------------------------

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const s = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[meio - 1] + s[meio]) / 2 : s[meio];
}

/** Valor de corte do quartil inferior (25º percentil), pelo método do "vizinho mais
 *  próximo": simples e suficiente para sinalizar candidatos, não para relatório
 *  estatístico. */
function quartil25(valores: number[]): number {
  if (valores.length === 0) return 0;
  const s = [...valores].sort((a, b) => a - b);
  const idx = Math.floor(0.25 * (s.length - 1));
  return s[idx];
}
