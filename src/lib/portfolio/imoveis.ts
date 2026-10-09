// IMÓVEIS (V4, REDESENHO.md §4.2). Módulo PURO: os prédios com os seus agregados, os
// filtros e a ordem da vista em cartões.
//
// O estado de um mês num prédio é o PIOR estado entre as frações nesse mês: um prédio com
// cinco frações pagas e uma em falta tem um mês em falta. É a leitura certa para quem
// pergunta "está tudo bem nesta casa?"; o detalhe fração a fração está um toque abaixo.

import { emAtrasoDaCarteira } from "./insights";
import { agruparPredios } from "./predios";
import type { Ativo, Snapshot } from "./snapshot";
import type { MonthCellStatus } from "../monthcell";

/** Os meses de um cartão: os fechados que a app conhece, mais o mês em curso. */
export type EstadoMes = MonthCellStatus | "curso";
export type EstadoPredio = "atraso" | "parado" | "vaga" | "terreno" | "vendido" | "em_dia";

export interface ResumoPredio {
  chave: string;
  nome: string;
  morada: string | null;
  tipo: "urbano" | "terrenos" | "sem_artigo";
  fracoes: Array<Ativo & { rotulo: string }>;
  arrendadas: number;
  correntes: number;
  renda: number;
  divida: number;
  meses: EstadoMes[];
  estado: EstadoPredio;
  /** Ids dos senhorios titulares de alguma fração (filtro por senhorio). */
  senhorios: string[];
  atualizaveis: number;
}

export const MESES_NO_CARTAO = 6;

/** Pior primeiro. `fora` (sem contrato) só ganha se não houver mais nada. */
const ORDEM: MonthCellStatus[] = ["falta", "parcial", "futuro", "pago", "fora"];

export function piorEstado(estados: MonthCellStatus[]): MonthCellStatus {
  let melhorIdx = ORDEM.length - 1;
  for (const e of estados) melhorIdx = Math.min(melhorIdx, ORDEM.indexOf(e));
  return ORDEM[melhorIdx];
}

type Entrada = Pick<Snapshot, "ativos" | "fontes" | "fonteDoContrato" | "arrears">;

export function resumirPredios(snap: Entrada): ResumoPredio[] {
  const dividaPorFracao = new Map<string, number>();
  for (const r of emAtrasoDaCarteira(snap)) {
    dividaPorFracao.set(r.propertyId, (dividaPorFracao.get(r.propertyId) ?? 0) + r.debt);
  }
  const parados = new Set(snap.fontes.filter((f) => f.parada).map((f) => f.landlord.id));

  return agruparPredios(snap.ativos).map((p) => {
    const correntes = p.fracoes.filter((f) => f.corrente);
    const comContrato = correntes.filter((f) => f.activeContract);
    const fechados = MESES_NO_CARTAO - 1;
    const largura = Math.max(0, ...correntes.map((f) => f.faixa.length));
    const meses: EstadoMes[] = [];
    for (let i = Math.max(0, largura - fechados); i < largura; i++) {
      meses.push(piorEstado(correntes.map((f) => f.faixa[i]?.status ?? "fora")));
    }
    while (meses.length < fechados) meses.unshift("fora");
    meses.push("curso");

    const divida = p.fracoes.reduce((s, f) => s + (dividaPorFracao.get(f.property.id) ?? 0), 0);
    const parado = comContrato.some((f) => {
      const fonte = snap.fonteDoContrato[f.activeContract!.id];
      return !!fonte && parados.has(fonte);
    });
    const vaga = correntes.some((f) => !f.activeContract);
    const estado: EstadoPredio =
      divida > 0
        ? "atraso"
        : parado
          ? "parado"
          : vaga
            ? "vaga"
            : correntes.length > 0
              ? "em_dia"
              : p.fracoes.every((f) => f.property.status === "vendido")
                ? "vendido"
                : "terreno";

    return {
      chave: p.chave,
      nome: p.nome,
      morada: p.morada,
      tipo: p.tipo,
      fracoes: p.fracoes,
      arrendadas: comContrato.length,
      correntes: correntes.length,
      renda: comContrato.reduce((s, f) => s + f.activeContract!.rent, 0),
      divida,
      meses,
      estado,
      senhorios: Array.from(new Set(p.fracoes.flatMap((f) => f.titulares.map((t) => t.landlord.id)))),
      atualizaveis: comContrato.filter(
        (f) => f.rendaAtualizavel?.eligible && (f.rendaAtualizavel.suggestedRent ?? 0) > f.activeContract!.rent,
      ).length,
    };
  });
}

export type FiltroImoveis = "todos" | "atraso" | "vagas" | "atualizavel";
export type OrdemImoveis = "estado" | "renda" | "nome";

const PESO: Record<EstadoPredio, number> = { atraso: 0, parado: 1, vaga: 2, em_dia: 3, terreno: 4, vendido: 5 };

export function filtrarPredios(
  lista: ResumoPredio[],
  { filtro = "todos", senhorio, ordem = "estado" }: { filtro?: FiltroImoveis; senhorio?: string; ordem?: OrdemImoveis },
): ResumoPredio[] {
  const out = lista.filter((p) => {
    if (senhorio && !p.senhorios.includes(senhorio)) return false;
    if (filtro === "atraso") return p.divida > 0;
    if (filtro === "vagas") return p.correntes > p.arrendadas;
    if (filtro === "atualizavel") return p.atualizaveis > 0;
    return true;
  });
  const porNome = (a: ResumoPredio, b: ResumoPredio) => a.nome.localeCompare(b.nome, "pt", { numeric: true });
  if (ordem === "nome") return out.sort(porNome);
  if (ordem === "renda") return out.sort((a, b) => b.renda - a.renda || porNome(a, b));
  return out.sort((a, b) => PESO[a.estado] - PESO[b.estado] || b.divida - a.divida || porNome(a, b));
}
