import { redirect } from "next/navigation";

// "Dinheiro" e "Relatórios" deram lugar a Rentabilidade e Impostos (plano de clareza, Fase 5).
// As ligações antigas continuam a funcionar.
export default async function Dinheiro({ searchParams }: { searchParams: Promise<{ tab?: string; ano?: string; senhorio?: string }> }) {
  const sp = await searchParams;
  if (sp.tab === "analise") redirect("/rentabilidade?tab=projecao");
  if (sp.tab === "mercado") redirect("/rentabilidade?tab=mercado");
  const q = new URLSearchParams(Object.entries({ ano: sp.ano, senhorio: sp.senhorio }).filter((e): e is [string, string] => !!e[1]));
  redirect(`/impostos${q.size ? `?${q}` : ""}`);
}
