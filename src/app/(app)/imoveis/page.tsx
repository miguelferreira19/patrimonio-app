// IMÓVEIS (V4, REDESENHO.md §4.2). Substitui a Carteira como destino.
//
// O objeto passa a ser o PRÉDIO (agrupado pelo artigo matricial, lib/portfolio/predios.ts),
// em cartões com uma fachada desenhada, o estado dos últimos meses e o que importa num
// relance: em atraso, quanto, ou a renda. A faixa de 24 meses × 53 frações continua a
// existir como "Histórico mensal" (/carteira), para quem quer a grelha toda.
//
// Os filtros vivem no URL, como as lentes da Carteira: partilháveis e sem estado no cliente.

import Link from "next/link";
import { History, TrendingUp } from "lucide-react";
import { PropertyFormButton } from "@/components/forms";
import { CartaoPredio } from "@/components/imoveis/cartao-predio";
import { MesesLegenda } from "@/components/imoveis/meses";
import { Money } from "@/components/kit";
import { buttonClass, cn } from "@/components/ui";
import { geoOptionsFromBenchmarks } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { getSnapshot } from "@/lib/portfolio";
import { filtrarPredios, resumirPredios, type FiltroImoveis, type OrdemImoveis } from "@/lib/portfolio/imoveis";
import { emAtrasoDaCarteira } from "@/lib/portfolio/insights";
import { fetchGeoOptions } from "@/lib/portfolio/load";

export const dynamic = "force-dynamic";

const FILTROS: Array<[FiltroImoveis, string]> = [
  ["todos", "Todos"],
  ["atraso", "Com atraso"],
  ["parados", "Recibos parados"],
  ["vagas", "Com vagas"],
  ["atualizavel", "Renda atualizável"],
];
const ORDENS: Array<[OrdemImoveis, string]> = [
  ["estado", "Estado"],
  ["renda", "Renda"],
  ["nome", "Nome"],
];

export default async function Imoveis({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; s?: string; o?: string }>;
}) {
  const sp = await searchParams;
  const [{ isAdmin, supabase }, snap] = await Promise.all([getSession(), getSnapshot()]);

  const filtro = (FILTROS.find(([k]) => k === sp.f)?.[0] ?? "todos") as FiltroImoveis;
  const ordem = (ORDENS.find(([k]) => k === sp.o)?.[0] ?? "estado") as OrdemImoveis;
  const senhorio = sp.s || undefined;

  const todos = resumirPredios(snap);
  const visiveis = filtrarPredios(todos, { filtro, senhorio, ordem });
  const contagem: Record<FiltroImoveis, number> = {
    todos: filtrarPredios(todos, { senhorio }).length,
    atraso: filtrarPredios(todos, { filtro: "atraso", senhorio }).length,
    parados: filtrarPredios(todos, { filtro: "parados", senhorio }).length,
    vagas: filtrarPredios(todos, { filtro: "vagas", senhorio }).length,
    atualizavel: filtrarPredios(todos, { filtro: "atualizavel", senhorio }).length,
  };
  const senhorios = Array.from(
    new Map(snap.ativos.flatMap((a) => a.titulares.map((t) => [t.landlord.id, t.landlord] as const))).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "pt"));

  const fracoes = snap.ativos.length;
  const correntes = snap.correntes.length;
  const arrendadas = snap.correntes.filter((a) => a.activeContract).length;
  const terrenos = snap.ativos.length - correntes;
  const atraso = emAtrasoDaCarteira(snap);
  const divida = atraso.reduce((s, r) => s + r.debt, 0);

  const geoOptions = isAdmin ? geoOptionsFromBenchmarks(await fetchGeoOptions(supabase)) : [];

  /** Um link que muda UM parâmetro e mantém os outros. */
  const href = (muda: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const atual = { f: filtro === "todos" ? undefined : filtro, s: senhorio, o: ordem === "estado" ? undefined : ordem, ...muda };
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    const q = p.toString();
    return q ? `/imoveis?${q}` : "/imoveis";
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-tinta-3">Imóveis</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] md:text-[30px]">
            {todos.length} imóveis, {fracoes} frações
          </h1>
          <p className="mt-1.5 text-sm text-tinta-2">Agrupados por prédio, pelo artigo matricial.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/carteira" className={buttonClass({ variant: "outline" })}>
            <History size={15} strokeWidth={1.75} />
            Histórico mensal
          </Link>
          <Link href="/dinheiro?tab=mercado" className={buttonClass({ variant: "outline" })}>
            <TrendingUp size={15} strokeWidth={1.75} />
            Mercado
          </Link>
          {isAdmin && <PropertyFormButton landlords={senhorios} geoOptions={geoOptions} />}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Renda contratada" valor={<Money value={snap.totais.rendaContratada} escala="xl" />} nota="por mês" />
        <Kpi
          rotulo="Ocupação"
          valor={<span className="text-2xl font-semibold tabular-nums">{arrendadas} de {correntes}</span>}
          nota={`${correntes - arrendadas} por arrendar${terrenos > 0 ? ` · ${terrenos} terrenos e vendidos à parte` : ""}`}
        />
        <Kpi
          rotulo="Em atraso"
          valor={<Money value={divida} escala="xl" tom={divida > 0 ? "perda" : "tinta"} />}
          nota={`${atraso.length} ${atraso.length === 1 ? "contrato" : "contratos"}`}
        />
        <Kpi rotulo="Valor patrimonial" valor={<Money value={snap.totais.vptTotal} escala="xl" />} nota="soma dos VPT" />
      </div>

      <div className="space-y-3">
        <p className="text-sm text-tinta-2">{visiveis.length} de {todos.length} prédios · abre um cartão para ver as frações.{(filtro !== "todos" || senhorio) && <Link href="/imoveis" className="ml-2 font-medium text-acao underline">Limpar filtros</Link>}</p>
        <nav aria-label="Filtros" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {FILTROS.map(([k, rotulo]) => (
            <Pilula key={k} href={href({ f: k === "todos" ? undefined : k })} ativa={filtro === k}>
              {rotulo}
              <span className="tabular-nums opacity-60">{contagem[k]}</span>
            </Pilula>
          ))}
          <span className="mx-1 hidden w-px self-stretch bg-regua md:block" aria-hidden="true" />
          {senhorios.map((l) => (
            <Pilula key={l.id} href={href({ s: senhorio === l.id ? undefined : l.id })} ativa={senhorio === l.id}>
              {l.name}
            </Pilula>
          ))}
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MesesLegenda />
          <p className="flex items-center gap-1 text-xs text-tinta-3">
            Ordenar:
            {ORDENS.map(([k, rotulo]) => (
              <Link
                key={k}
                href={href({ o: k === "estado" ? undefined : k })}
                aria-current={ordem === k ? "true" : undefined}
                className={cn("rounded-full px-2 py-0.5", ordem === k ? "bg-vellum font-medium text-tinta" : "hover:text-tinta-2")}
              >
                {rotulo}
              </Link>
            ))}
          </p>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-2xl border border-regua bg-carta px-5 py-8 text-center text-sm text-tinta-2">
          Nenhum imóvel com este filtro.{" "}
          <Link href="/imoveis" className="font-medium text-acao hover:underline">
            Ver todos
          </Link>
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {visiveis.map((p) => (
            <li key={p.chave}>
              <CartaoPredio p={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kpi({ rotulo, valor, nota }: { rotulo: string; valor: React.ReactNode; nota: string }) {
  return (
    <div className="rounded-2xl border border-regua bg-carta px-4 py-3.5">
      <p className="text-xs font-medium text-tinta-2">{rotulo}</p>
      <div className="mt-1.5">{valor}</div>
      <p className="mt-1 text-xs text-tinta-3">{nota}</p>
    </div>
  );
}

function Pilula({ href, ativa, children }: { href: string; ativa: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={ativa ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 md:min-h-9",
        ativa ? "border-tinta bg-tinta text-papel" : "border-regua bg-carta text-tinta-2 hover:border-regua-forte hover:text-tinta",
      )}
    >
      {children}
    </Link>
  );
}
