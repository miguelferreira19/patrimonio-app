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
import { OwnerSelection, ScopeFilters, OperationalTable } from "@/components/gestao/operacional";
import { operationalData, type OperationalQuery } from "@/lib/portfolio/operacional";
import { shareOf, AMBITO_LABEL, type Ambito } from "@/lib/gestao";

export const dynamic = "force-dynamic";

const FILTROS: Array<[FiltroImoveis, string]> = [
  ["todos", "Todos"],
  ["atraso", "Com atraso"],
  ["parados", "Sem informação"],
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
  searchParams: Promise<OperationalQuery & { f?: string; s?: string; o?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const [{ isAdmin, supabase }, snap] = await Promise.all([getSession(), getSnapshot()]);
  const currentUrl = `/imoveis?${new URLSearchParams(Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"))}`;
  if (sp.vista === "tabela") { const data = await operationalData({ ...sp, senhorio: sp.senhorio || sp.s }); if (data.scope === "proprietario" && !data.raw.landlords.some((l) => l.id === (sp.senhorio || sp.s))) return <OwnerSelection title="Imóveis" q={sp} landlords={data.raw.landlords} action="/imoveis" hidden={{ vista: "tabela" }} />; return <div className="space-y-6"><h1 className="text-2xl font-semibold">Imóveis · consulta operacional</h1><Link href={currentUrl.replace(/vista=tabela/, "vista=cartoes")} className={buttonClass({ variant: "outline" })}>Ver cartões</Link><ScopeFilters q={sp} landlords={data.raw.landlords} action="/imoveis" hidden={{ vista: "tabela" }} /><p className="text-sm text-tinta-2">{AMBITO_LABEL[data.scope]} · {data.from.slice(0, 7)} a {data.to.slice(0, 7)} · montantes líquidos, salvo renda contratada ilíquida</p><OperationalTable data={data} q={sp} back="/imoveis" /></div>; }

  const filtro = (FILTROS.find(([k]) => k === sp.f)?.[0] ?? "todos") as FiltroImoveis;
  const ordem = (ORDENS.find(([k]) => k === sp.o)?.[0] ?? "estado") as OrdemImoveis;
  const senhorio = sp.senhorio || sp.s || undefined;
  const scope: Ambito = ["carteira", "proprietario"].includes(sp.ambito ?? "") ? sp.ambito as Ambito : "inteiro";

  const owners = snap.ativos.flatMap((a) => a.titulares.map((t) => ({ property_id: a.property.id, landlord_id: t.landlord.id, quota: t.quota })));
  const allLandlords = [...new Map(snap.ativos.flatMap((a) => a.titulares.map((t) => [t.landlord.id, t.landlord] as const))).values()];
  if (scope === "proprietario" && !allLandlords.some((l) => l.id === senhorio)) return <OwnerSelection title="Imóveis" q={sp} landlords={allLandlords} action="/imoveis" />;
  const scopedAssets = snap.ativos.filter((a) => (!senhorio || a.titulares.some((t) => t.landlord.id === senhorio)) && (!sp.q || `${a.property.name} ${a.property.address} ${a.activeContract?.tenant_name}`.toLowerCase().includes(sp.q.toLowerCase())));
  const share = (id: string) => shareOf(id, owners, allLandlords, scope, senhorio);
  const debts = new Map(emAtrasoDaCarteira(snap).map((r) => [r.propertyId, r.debt]));
  const todos = resumirPredios({ ...snap, ativos: scopedAssets }).map((p) => ({ ...p, renda: p.fracoes.reduce((n, a) => n + (a.activeContract?.rent ?? 0) * (share(a.property.id) ?? 0), 0), divida: p.fracoes.reduce((n, a) => n + (debts.get(a.property.id) ?? 0) * (share(a.property.id) ?? 0), 0) }));
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

  const filteredAssets = visiveis.flatMap((p) => p.fracoes);
  const fracoes = filteredAssets.length;
  const correntes = filteredAssets.filter((a) => a.corrente).length;
  const arrendadas = filteredAssets.filter((a) => a.corrente && a.activeContract).length;
  const terrenos = fracoes - correntes;
  const atraso = emAtrasoDaCarteira(snap).filter((r) => filteredAssets.some((a) => a.property.id === r.propertyId));
  const divida = atraso.reduce((s, r) => s + r.debt * (share(r.propertyId) ?? 0), 0);

  const geoOptions = isAdmin ? geoOptionsFromBenchmarks(await fetchGeoOptions(supabase)) : [];

  /** Um link que muda UM parâmetro e mantém os outros. */
  const href = (muda: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const atual = { ...sp, f: filtro === "todos" ? undefined : filtro, s: senhorio, o: ordem === "estado" ? undefined : ordem, ...muda };
    if ("s" in muda) { atual.senhorio = muda.s; atual.s = undefined; }
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    const q = p.toString();
    return q ? `/imoveis?${q}` : "/imoveis";
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] md:text-[30px]">
            Imóveis
          </h1>
          <p className="mt-1.5 text-sm text-tinta-2">{visiveis.length} prédios · {fracoes} frações · {AMBITO_LABEL[scope]} · situação atual.{filteredAssets.some((a) => share(a.property.id) === null) && " Quotas desconhecidas excluídas dos totais."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={href({ vista: "tabela" })} className={buttonClass({ variant: "outline" })}>Consulta operacional</Link><Link href="/vagas" className={buttonClass({ variant: "outline" })}>Disponibilidade</Link>
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
      <ScopeFilters q={sp} landlords={allLandlords} action="/imoveis" period={false} hidden={{ f: sp.f ?? "", o: sp.o ?? "" }} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Renda contratada" valor={<Money value={filteredAssets.reduce((n, a) => n + (a.activeContract?.rent ?? 0) * (share(a.property.id) ?? 0), 0)} escala="xl" />} nota="por mês · ilíquida" />
        <Kpi
          rotulo="Ocupação"
          valor={<span className="text-2xl font-semibold tabular-nums">{arrendadas} de {correntes}</span>}
          nota={`${correntes - arrendadas} por arrendar${terrenos > 0 ? ` · ${terrenos} terrenos e vendidos à parte` : ""}`}
        />
        <Kpi
          rotulo="Em atraso"
          valor={<Money value={divida} escala="xl" tom={divida > 0 ? "atencao" : "tinta"} />}
          nota={`${atraso.length} ${atraso.length === 1 ? "contrato" : "contratos"}`}
        />
        <Kpi rotulo="Valor patrimonial" valor={<Money value={filteredAssets.reduce((n, a) => n + (a.property.vpt ?? 0) * (share(a.property.id) ?? 0), 0)} escala="xl" />} nota="soma dos VPT registados" />
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
            <li key={p.chave} className="min-w-0">
              <CartaoPredio p={p} back={currentUrl} scopeLabel={scope === "inteiro" ? undefined : AMBITO_LABEL[scope]} />
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
