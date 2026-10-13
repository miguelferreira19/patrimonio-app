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
// já existem (`renda.ts`, `futuro.ts`, `snapshot.ts`, `calc.ts`).
//
// Saíram a 13/10/2026 (PLANO_CLAREZA.md 3.5) os conselhos que ordenavam património ao lado
// de rendimento: "rever a venda" (o VALOR da fração, 207 mil €, à frente de rendas de
// 3 mil €/ano), "capacidade de investimento" (o resultado projetado com outro nome) e
// "rever o yield". O rendimento face ao valor vive agora na Rentabilidade.

import { nomeDaFracao } from "./predios";
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
        acoes: [{ label: "Ver rendas", href: "/imoveis?o=renda" }],
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
            .map((c) => `${c.property ? nomeDaFracao(c.property) : "fração"} (${c.contract.end_date})`)
            .join(", ") + (n > 3 ? `, e outros ${n - 3}` : "") + ".",
        euros: total,
        confianca: "medido",
        conta: `Σ renda anual dos contratos que terminam = ${fmtEur(total)}.`,
        acoes: [{ label: "Ver vagas", href: "/imoveis?f=vagas" }],
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
        acoes: [{ label: "Ver rendas", href: "/imoveis?o=renda" }],
      },
    ];
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
