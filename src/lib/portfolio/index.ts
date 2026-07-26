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
import { monthKeyFromDate } from "../format";
import { loadRaw } from "./load";
import { buildSnapshot, type Snapshot } from "./snapshot";

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
