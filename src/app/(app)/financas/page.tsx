import { Lede, Pilulas } from "@/components/kit";
import { getSession } from "@/lib/data";
import { todayISO } from "@/lib/format";
import Ano from "@/components/impostos/ano";
import Resultado from "@/components/financas/resultado";
import Calendario from "@/components/financas/calendario";
import Poupanca from "@/components/financas/poupanca";
import { separadorFinanceiro } from "@/components/financas/modelo";
import Mercado from "@/components/rentabilidade/mercado";
import Despesas from "@/components/rentabilidade/despesas";
import Projecao from "@/components/rentabilidade/projecao";

export const dynamic = "force-dynamic";
type Query = { tab?: string; ano?: string; senhorio?: string; ordem?: string; ambito?: string };

export default async function Financas({ searchParams }: { searchParams: Promise<Query> }) {
  const [sp, { isAdmin }] = await Promise.all([searchParams, getSession()]);
  const tab = separadorFinanceiro(sp.tab);
  const hoje = todayISO();
  const ano = sp.ano && /^\d{4}$/.test(sp.ano) ? sp.ano :
    String(Number(hoje.slice(0, 4)) - (Number(hoje.slice(5, 7)) < 7 ? 1 : 0));
  const itens = [["resultado", "Resultado"], ["impostos", "Impostos"], ["calendario", "Calendário"], ["poupanca", "Poupança"]];
  return <div className="mx-auto w-full max-w-2xl space-y-6 tabular-nums">
    <Lede title="Finanças" />
    <Pilulas ativo={tab} itens={itens.map(([id, rotulo]) => ({ id, rotulo, href: `/financas?tab=${id}` }))} />
    {tab === "resultado" && <>
      <Resultado ordem={sp.ordem} />
      <details open={sp.tab === "mercado"}><summary className="flex min-h-11 cursor-pointer items-center text-lg font-semibold">Mercado</summary>
        <Mercado searchParams={Promise.resolve(sp)} /></details>
      {isAdmin && <>
        <details open={sp.tab === "despesas"}><summary className="flex min-h-11 cursor-pointer items-center text-lg font-semibold">Despesas</summary>
          <Despesas searchParams={Promise.resolve(sp)} /></details>
        <details open={sp.tab === "projecao"}><summary className="flex min-h-11 cursor-pointer items-center text-lg font-semibold">Projeção</summary>
          <Projecao searchParams={Promise.resolve(sp)} /></details>
      </>}
    </>}
    {tab === "impostos" && <Ano params={Promise.resolve({ ano })} searchParams={Promise.resolve({ senhorio: sp.senhorio })} />}
    {tab === "calendario" && <Calendario isAdmin={isAdmin} />}
    {tab === "poupanca" && <Poupanca />}
  </div>;
}