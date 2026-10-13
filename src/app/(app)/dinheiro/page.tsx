// DINHEIRO (V4, REDESENHO.md §4.4): o IRS de cada ano, a análise da carteira e o mercado,
// num só destino com separadores. As três páginas já existiam e estão testadas; aqui
// juntam-se sem duplicar cálculo nenhum. A Análise continua só para o admin.
import Link from "next/link";
import { cn } from "@/components/ui";
import { getSession } from "@/lib/data";
import AnoPage from "../ano/[ano]/page";
import AnalisePage from "../analise/page";
import MercadoPage from "../mercado/page";

export const dynamic = "force-dynamic";

export default async function Dinheiro({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ano?: string; senhorio?: string; ambito?: string }>;
}) {
  const sp = await searchParams;
  const { isAdmin } = await getSession();
  const tabs: Array<[string, string]> = [
    ["irs", "IRS e impostos"],
    ...(isAdmin ? ([["analise", "Projeção e conselhos"]] as Array<[string, string]>) : []),
    ["mercado", "Mercado"],
  ];
  const tab = tabs.some(([k]) => k === sp.tab) ? sp.tab! : "irs";
  const ano = sp.ano && /^\d{4}$/.test(sp.ano) ? sp.ano : String(new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0));

  return (
    <div className="space-y-6">
      <div>
        <nav aria-label="Relatórios" className="-mx-4 flex gap-1 overflow-x-auto border-b border-regua px-4 md:mx-0 md:px-0">
          {tabs.map(([k, nome]) => (
            <Link
              key={k}
              href={`/relatorios?${new URLSearchParams({ ano, tab: k, ...(sp.senhorio ? { senhorio: sp.senhorio } : {}), ...(sp.ambito ? { ambito: sp.ambito } : {}) })}`}
              aria-current={tab === k ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                tab === k ? "border-tinta text-tinta" : "border-transparent text-tinta-3 hover:text-tinta-2",
              )}
            >
              {nome}
            </Link>
          ))}
        </nav>
        <p className="mt-3 text-sm text-tinta-2">{tab === "irs" ? "Recibos, despesas e estimativa de imposto por ano e senhorio." : tab === "analise" ? "Evolução, cenários futuros e oportunidades da carteira." : "Rendas e valores por metro quadrado comparados com o INE."}</p>
      </div>
      {tab === "irs" && (
        <AnoPage params={Promise.resolve({ ano })} searchParams={Promise.resolve({ senhorio: sp.senhorio, emDinheiro: "1" })} />
      )}
      {tab === "analise" && <AnalisePage searchParams={Promise.resolve(sp)} />}
      {tab === "mercado" && <MercadoPage searchParams={Promise.resolve(sp)} />}
    </div>
  );
}
