// RENTABILIDADE (PLANO_CLAREZA.md, Fase 3). Módulo PURO: o que cada fração e cada prédio
// rendeu, custou e deixou num ano fechado. Responde a "quais os mais rentáveis?", que a app
// não respondia em lado nenhum.
//
// Janela: os 12 meses que acabam na fronteira comum (o último mês que TODAS as fontes de
// recibos conhecem). Depois dela a herança do avô não tem recibos, e um prédio dele parecia
// render menos só por isso.
//
// Renda = recibos emitidos (ilíquido): é o rendimento, e a retenção é imposto adiantado,
// não um custo. Custos = despesas por inteiro (a regra sem duplicar, gestao.ts) com as
// obras pela média de 3 anos, como na projeção (futuro.ts).

import { lastMonthsKeys } from "../format";
import { contractActiveInMonth } from "../calc";
import { CATEGORIAS_DE_OBRAS } from "./futuro";
import { agruparPredios, nomeDaFracao } from "./predios";
import type { Contract, Expense, Property } from "../types";

export interface LinhaRentabilidade {
  property: Property;
  nome: string;
  renda: number;
  custos: number;
  resultado: number;
  /** Meses da janela com recibo emitido. */
  mesesPagos: number;
  /** Meses da janela sem nenhum contrato ativo. */
  mesesVagos: number;
  /** Valor de mercado estimado (área × mediana do INE); null sem área ou sem mediana. */
  valor: number | null;
  /** resultado ÷ valor estimado. */
  rendimento: number | null;
}

export interface PredioRentabilidade {
  chave: string;
  nome: string;
  fracoes: LinhaRentabilidade[];
  renda: number;
  custos: number;
  resultado: number;
  mesesVagos: number;
  /** Só quando TODAS as frações têm valor estimado: uma soma parcial enganava o rendimento. */
  valor: number | null;
  rendimento: number | null;
}

export interface Rentabilidade {
  meses: string[];
  fracoes: LinhaRentabilidade[];
  predios: PredioRentabilidade[];
  totais: { renda: number; custos: number; resultado: number; mesesVagos: number; valor: number; rendimento: number | null };
}

const mesDe = (data: string) => `${data.slice(0, 7)}-01`;
const arred = (v: number) => Math.round(v * 100) / 100;

export function rentabilidade({
  ativos,
  recibos,
  despesas,
  fim,
}: {
  ativos: Array<{ property: Property; contracts: Contract[]; valor: number | null }>;
  /** Recibos da janela (ou mais largos: filtra-se aqui). */
  recibos: Array<{ property_id: string | null; ref_month: string; amount: number; cancelled?: boolean }>;
  /** Despesas JÁ por inteiro (scopedExpense "inteiro" com quotasDeclarantes). */
  despesas: Array<Pick<Expense, "property_id" | "category" | "expense_date" | "amount">>;
  /** Último mês da janela ("YYYY-MM-01"). */
  fim: string;
}): Rentabilidade {
  const meses = lastMonthsKeys(12, fim);
  const naJanela = new Set(meses);
  const inicioObras = lastMonthsKeys(36, fim)[0];

  const fracoes: LinhaRentabilidade[] = ativos.map(({ property, contracts, valor }) => {
    const seus = recibos.filter((r) => r.property_id === property.id && !r.cancelled && naJanela.has(mesDe(r.ref_month)));
    const renda = seus.reduce((n, r) => n + Number(r.amount), 0);
    const mesesPagos = new Set(seus.filter((r) => Number(r.amount) > 0).map((r) => mesDe(r.ref_month))).size;
    const mesesVagos = meses.filter((m) => !contracts.some((c) => contractActiveInMonth(c, m))).length;
    let custos = 0;
    for (const e of despesas) {
      if (e.property_id !== property.id) continue;
      const m = mesDe(e.expense_date);
      if (CATEGORIAS_DE_OBRAS.has(e.category)) {
        if (m >= inicioObras && m <= fim) custos += Number(e.amount) / 3;
      } else if (naJanela.has(m)) {
        custos += Number(e.amount);
      }
    }
    const resultado = renda - custos;
    return {
      property,
      nome: nomeDaFracao(property),
      renda: arred(renda),
      custos: arred(custos),
      resultado: arred(resultado),
      mesesPagos,
      mesesVagos,
      valor,
      rendimento: valor && valor > 0 ? resultado / valor : null,
    };
  });

  const predios: PredioRentabilidade[] = agruparPredios(fracoes).map((p) => {
    const soma = (f: (l: LinhaRentabilidade) => number) => arred(p.fracoes.reduce((n, l) => n + f(l), 0));
    const comValor = p.fracoes.every((l) => l.valor !== null);
    const valor = comValor ? soma((l) => l.valor ?? 0) : null;
    const resultado = soma((l) => l.resultado);
    return {
      chave: p.chave,
      nome: p.nome,
      fracoes: p.fracoes,
      renda: soma((l) => l.renda),
      custos: soma((l) => l.custos),
      resultado,
      mesesVagos: p.fracoes.reduce((n, l) => n + l.mesesVagos, 0),
      valor,
      rendimento: valor && valor > 0 ? resultado / valor : null,
    };
  });

  const total = (f: (l: LinhaRentabilidade) => number) => arred(fracoes.reduce((n, l) => n + f(l), 0));
  const comValor = fracoes.filter((l) => l.valor !== null && l.valor > 0);
  const valor = comValor.reduce((n, l) => n + (l.valor ?? 0), 0);
  return {
    meses,
    fracoes: fracoes.sort((a, b) => b.resultado - a.resultado),
    predios: predios.sort((a, b) => b.resultado - a.resultado),
    totais: {
      renda: total((l) => l.renda),
      custos: total((l) => l.custos),
      resultado: total((l) => l.resultado),
      mesesVagos: fracoes.reduce((n, l) => n + l.mesesVagos, 0),
      valor,
      // Só sobre as frações com valor: misturar as que não o têm baixava o rendimento.
      rendimento: valor > 0 ? comValor.reduce((n, l) => n + l.resultado, 0) / valor : null,
    },
  };
}
