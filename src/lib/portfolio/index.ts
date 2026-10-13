// Ponto de entrada da camada de portfólio.
//
// `getSnapshot()` não recebe argumentos de propósito: é o que permite ao `cache()` do
// React deduplicar de verdade. Com um cliente Supabase ou um `Date` como argumento, cada
// chamada criaria uma chave nova e o cache não servia para nada — e o objetivo desta fase
// é exatamente UMA leitura e UM cálculo por request, em vez dos 13 da V1.
//
// A parte pura (`buildSnapshot`) fica separada e testada em snapshot.check.ts, que prova
// que este refactor não muda nenhum número.

import { cache } from "react";
import { createClient } from "../supabase/server";
import { monthKeyFromDate, todayISO } from "../format";
import { aimiPorSenhorio, construirAgenda, rendasDosAtivos } from "./agenda";
import { loadRaw } from "./load";
import { buildSnapshot, type Snapshot } from "./snapshot";
import { declaredContractDates } from "../gestao";

export const getSnapshot = cache(async (): Promise<Snapshot> => {
  const supabase = await createClient();
  const today = new Date();
  const raw = await loadRaw(supabase, monthKeyFromDate(today));
  return buildSnapshot(raw, today);
});

/** Snapshot SEM o histórico de pagamentos — a leitura mais cara, de longe (5.100 linhas).
 *  Para páginas que só descrevem a carteira (Frações, Mercado): inquilino, renda, €/m²,
 *  desvio ao mercado. `arrears`, `faixa`, `fluxo` e `carteira` vêm vazios, e
 *  `historicoCarregado` fica false para o dizer. */
export const getSnapshotLeve = cache(async (): Promise<Snapshot> => {
  const supabase = await createClient();
  const today = new Date();
  const raw = await loadRaw(supabase, monthKeyFromDate(today), { comHistorico: false });
  return buildSnapshot(raw, today);
});

/** Snapshot MAIS o `raw` que o produziu, numa só leitura.
 *
 *  A `/analise` precisa de coisas que o snapshot não expõe de propósito: o histórico
 *  completo de pagamentos (o snapshot só passa a janela de 12 meses às superfícies, para
 *  não desperdiçar payload RSC), as despesas, as atualizações de renda e os coeficientes.
 *  Em vez de alargar o `Snapshot` com quatro campos que só uma página usa, esta função
 *  devolve os dois e a página serve-se do que precisa. Continua a ser UMA leitura. */
export const getSnapshotComRaw = cache(async () => {
  const supabase = await createClient();
  const today = new Date();
  const raw = await loadRaw(supabase, monthKeyFromDate(today));
  return { raw, snap: buildSnapshot(raw, today), today };
});

export { buildSnapshot } from "./snapshot";
export type { Ativo, MesAgregado, Snapshot, SnapshotOptions } from "./snapshot";
export type { RawData } from "./load";
export { loadRaw } from "./load";

/** A agenda dos próximos `dias` (Início e /api/agenda). Lê pelo `getSnapshotComRaw`, por
 *  isso numa página que já o chamou não custa leitura nenhuma.
 *
 *  `comRendas`: as cartas de atualização são tarefas de quem decide (o admin). O viewer vê
 *  o calendário fiscal, que é da família toda (V3: separar o que cada um vê). */
export async function getAgenda(dias: number, { comRendas }: { comRendas: boolean }) {
  const { raw, snap } = await getSnapshotComRaw();
  const hoje = todayISO();
  const prazos = construirAgenda({
    hoje,
    dias,
    rendas: comRendas ? rendasDosAtivos(snap.correntes) : [],
    aimi: aimiPorSenhorio(raw.landlords, raw.owners, raw.properties),
  });
  const cutoff = new Date(hoje + "T12:00:00Z"); cutoff.setUTCDate(cutoff.getUTCDate() + dias);
  for (const c of raw.contracts.filter((c) => c.status === "ativo")) for (const [index, date] of declaredContractDates(c).entries()) {
    if (date.date >= hoje && date.date <= cutoff.toISOString().slice(0, 10)) prazos.push({ id: `contrato-${c.id}-${index}`, data: date.date, tipo: "contrato", titulo: `${date.label} · ${c.tenant_name}`, detalhe: `Fonte: ${c.term_source}. Verificar a vigência da cláusula antes de agir.`, euros: null, confianca: "medido", href: `/contratos?id=${c.id}` });
  }
  prazos.sort((a, b) => a.data.localeCompare(b.data));
  const contratosSemFim = raw.contracts.filter((c) => c.status === "ativo" && (!c.term_kind || c.term_kind === "desconhecido")).length;
  return { prazos, hoje, contratosSemFim };
}
