import { notFound } from "next/navigation";
import { lerArquivo } from "@/components/documentos/lista";
import { geoOptionsFromBenchmarks, sum } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { escopoSeguro } from "@/lib/documentos";
import { lastMonthsKeys } from "@/lib/format";
import { paginateAll } from "@/lib/paginate";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { fetchGeoOptions } from "@/lib/portfolio/load";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import { problemasDaFracao } from "@/lib/portfolio/problemas";
import { carregarEntradaDeProblemas } from "@/lib/portfolio/problemas-load";
import { linhas } from "@/lib/supabase/dados";
import type { Receipt } from "@/lib/types";
import { historicoDaFracao } from "./historico";

export async function carregarFracao(id: string) {
  const [{ snap, raw }, { supabase, isAdmin }] = await Promise.all([getSnapshotComRaw(), getSession()]);
  const ativo = snap.ativos.find((a) => a.property.id === id);
  if (!ativo) notFound();
  const [entrada, arquivo, recibos, geo] = await Promise.all([
    carregarEntradaDeProblemas(supabase, snap, snap.hoje), lerArquivo(supabase),
    paginateAll<Receipt>(async (de, ate) => linhas<Receipt>(await supabase.from("receipts").select("*")
      .eq("property_id", id).order("ref_month", { ascending: false }).order("id").range(de, ate), "receipts")),
    isAdmin ? fetchGeoOptions(supabase) : Promise.resolve([]),
  ]);
  const property = ativo.property;
  const active = ativo.activeContract;
  const expenses = raw.expenses.filter((e) => e.property_id === id)
    .sort((a, b) => b.expense_date.localeCompare(a.expense_date)).slice(0, 50);
  const months = lastMonthsKeys(12, `${snap.hoje.slice(0, 7)}-01`);
  const expenses12 = expenses.filter((e) => e.expense_date >= months[0]);
  const mv = ativo.mercado;
  const netYield = mv.estimatedValue && active ? (active.rent * 12 - sum(expenses12.map((e) => e.amount))) / mv.estimatedValue : null;
  const sobe = active && ativo.rendaAtualizavel?.eligible && (ativo.rendaAtualizavel.suggestedRent ?? 0) > active.rent
    ? ativo.rendaAtualizavel : null;
  return {
    property, active, isAdmin, mv, sobe, expenses, expenses12, netYield,
    semInformacao: !!active && (ativo.arrears?.stale === true || snap.fontes.some((f) => f.parada && f.landlord.id === snap.fonteDoContrato[active.id])),
    contracts: ativo.contracts, gaps: ativo.vazios, rotulo: nomeDaFracao(property),
    owners: raw.owners.filter((o) => o.property_id === id), landlords: raw.landlords,
    geoOptions: geoOptionsFromBenchmarks(geo), receipts: recibos.slice(0, 24),
    docsDaFracao: property.matriz_article ? arquivo.docs.filter((d) => d.escopo === escopoSeguro(property.matriz_article!)) : [],
    rentUpdates: raw.rentUpdates.filter((u) => ativo.contracts.some((c) => c.id === u.contract_id))
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date)),
    problemas: problemasDaFracao(id, entrada),
    ...historicoDaFracao(ativo, snap, raw.payments),
  };
}

export type DadosFracao = Awaited<ReturnType<typeof carregarFracao>>;
export const tabDaFracao = (id: string, tab: string, voltar: string) => `/fracoes/${id}?${new URLSearchParams({ tab, voltar })}`;
