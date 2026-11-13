import { upcomingContractEnds } from "../calc";
import { monthLabel } from "../format";
import { quotasDeclarantes, scopedExpense } from "../gestao";
import type { ManagementCase } from "../gestao";
import { classifyUso } from "../irs";
import { EXPENSE_CATEGORY_LABEL } from "../types";
import type { Expense } from "../types";
import { emAtrasoDaCarteira } from "./insights";
import { chaveDoPredio } from "./predios";
import type { Ativo, Snapshot } from "./snapshot";

export type TipoDeProblema =
  | "em_atraso" | "vaga" | "renda_parada" | "contrato_a_terminar"
  | "avaria" | "despesa_em_falta" | "prazo_desconhecido";

export type Problema = {
  tipo: TipoDeProblema;
  gravidade: 1 | 2 | 3;
  texto: string;
  desde?: string;
  valor?: number;
  href?: string;
};

export type CasoAberto = Pick<ManagementCase, "id" | "property_id" | "kind" | "status" | "priority" | "title">;
export type DespesaAnual = Expense;
export type EntradaDeProblemas = {
  snap: Snapshot;
  casos: CasoAberto[];
  despesas: DespesaAnual[];
  hoje: string;
};

const ordenar = (a: Problema, b: Problema) => b.gravidade - a.gravidade || (b.valor ?? 0) - (a.valor ?? 0);
const arredondar = (valor: number) => Math.round(valor * 100) / 100;

function mesesCompletos(desde: string, hoje: string): number {
  return Math.max(0,
    (Number(hoje.slice(0, 4)) - Number(desde.slice(0, 4))) * 12
    + Number(hoje.slice(5, 7)) - Number(desde.slice(5, 7))
    - (Number(hoje.slice(8, 10)) < Number(desde.slice(8, 10)) ? 1 : 0),
  );
}

function problemaDaVaga(a: Ativo, hoje: string): Problema[] {
  if (!a.corrente || a.activeContract) return [];
  const desde = a.vazios.find((g) => g.gapEnd === null)?.gapStart;
  const meses = desde ? mesesCompletos(desde, hoje) : null;
  const tipologia = (a.property.typology ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const pequena = /garagem|arrecadacao/.test(tipologia);
  const habitacao = classifyUso(a.property.typology) === "habitacao";
  const ultimaRenda = a.contracts[0]?.rent;
  return [{
    tipo: "vaga",
    gravidade: pequena ? 1 : habitacao && meses !== null && meses >= 6 ? 3 : 2,
    texto: desde
      ? `Vaga há ${meses} ${meses === 1 ? "mês" : "meses"} (desde ${monthLabel(desde)})`
      : "Vaga",
    ...(desde ? { desde } : {}),
    ...(ultimaRenda !== undefined ? { valor: arredondar(ultimaRenda * 12) } : {}),
    href: `/fracoes/${a.property.id}`,
  }];
}

function problemasDoContrato(a: Ativo, hoje: string): Problema[] {
  const c = a.activeContract;
  if (!a.corrente || !c) return [];
  const ps: Problema[] = [];
  const atualizacao = a.rendaAtualizavel;
  if (atualizacao?.eligible && (atualizacao.suggestedRent ?? 0) > c.rent) {
    ps.push({
      tipo: "renda_parada", gravidade: 1, texto: "Atualizar renda pelo coeficiente",
      ...(atualizacao.eligibleSince ? { desde: atualizacao.eligibleSince } : {}),
      valor: arredondar((atualizacao.suggestedRent! - c.rent) * 12), href: `/carta/${c.id}`,
    });
  }
  // O prazo registado vive em expected_end_date; os contratos antigos usam end_date.
  const fim = c.expected_end_date ?? c.end_date;
  if (upcomingContractEnds([{ ...c, end_date: fim }], hoje, 120).length > 0) {
    ps.push({
      tipo: "contrato_a_terminar", gravidade: 2, texto: `Contrato termina em ${monthLabel(fim!)}`,
      href: `/fracoes/${a.property.id}`,
    });
  }
  if (classifyUso(a.property.typology) === "habitacao" && !fim
    && c.term_kind !== "sem_termo" && !(c.duration_months && c.duration_months > 0)) {
    ps.push({
      tipo: "prazo_desconhecido", gravidade: 1, texto: "Prazo do contrato por registar",
      href: `/fracoes/${a.property.id}`,
    });
  }
  return ps;
}

function despesasEmFalta(a: Ativo, e: EntradaDeProblemas): Problema[] {
  const ano = Number(e.hoje.slice(0, 4)) - 1;
  const registadas = e.despesas.filter((d) => d.property_id === a.property.id && d.origem === "registada");
  const owners = a.titulares.map((t) => ({ property_id: a.property.id, landlord_id: t.landlord.id, quota: t.quota }));
  const declarantes = quotasDeclarantes(registadas, owners);
  const ps: Problema[] = [];
  for (const categoria of ["imi", "condominio", "seguro"] as const) {
    const destaCategoria = registadas.filter((d) => d.category === categoria);
    const anteriores = destaCategoria.filter((d) => Number(d.expense_date.slice(0, 4)) === ano - 1);
    if (anteriores.length === 0 || destaCategoria.some((d) => Number(d.expense_date.slice(0, 4)) === ano)) continue;
    const valores = anteriores.map((d) => scopedExpense(d, owners, [], "inteiro", undefined, declarantes).amount);
    const completo = valores.every((v) => v !== null);
    ps.push({
      tipo: "despesa_em_falta", gravidade: 1,
      texto: `${EXPENSE_CATEGORY_LABEL[categoria]} de ${ano} por registar`,
      ...(completo ? { valor: arredondar(valores.reduce<number>((s, v) => s + (v ?? 0), 0)) } : {}),
      href: `/fracoes/${a.property.id}`,
    });
  }
  return ps;
}

export function problemasDaFracao(propertyId: string, e: EntradaDeProblemas): Problema[] {
  const a = e.snap.ativos.find((f) => f.property.id === propertyId);
  if (!a) return [];
  const ps: Problema[] = emAtrasoDaCarteira(e.snap)
    .filter((r) => r.propertyId === propertyId)
    .map((r) => ({
      tipo: "em_atraso", gravidade: r.streak >= 3 ? 3 : 2,
      texto: `Em atraso: ${r.streak} ${r.streak === 1 ? "mês" : "meses"}`, valor: r.debt, href: `/fracoes/${propertyId}`,
    }));
  ps.push(...problemaDaVaga(a, e.hoje), ...problemasDoContrato(a, e.hoje));
  for (const caso of e.casos) {
    if (caso.property_id !== propertyId || caso.kind !== "manutencao" || caso.status === "concluido") continue;
    ps.push({
      tipo: "avaria", gravidade: caso.priority === "urgente" || caso.priority === "alta" ? 3 : 2,
      texto: caso.title, href: `/gestao/${caso.id}`,
    });
  }
  ps.push(...despesasEmFalta(a, e));
  return ps.sort(ordenar);
}

export function problemasPorPredio(e: EntradaDeProblemas): Map<string, Problema[]> {
  const porPredio = new Map<string, Problema[]>();
  for (const { property } of e.snap.ativos) {
    const { chave } = chaveDoPredio(property.matriz_article, property.id);
    const ps = porPredio.get(chave) ?? [];
    ps.push(...problemasDaFracao(property.id, e));
    porPredio.set(chave, ps);
  }
  for (const ps of porPredio.values()) ps.sort(ordenar);
  return porPredio;
}

export function contarPorGravidade(ps: Problema[]): { g3: number; g2: number; g1: number } {
  const contagem = { g3: 0, g2: 0, g1: 0 };
  for (const p of ps) contagem[`g${p.gravidade}`] += 1;
  return contagem;
}
