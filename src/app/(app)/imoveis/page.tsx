import Link from "next/link";
import { PropertyFormButton } from "@/components/forms";
import { CartaoPredio } from "@/components/imoveis/cartao-predio";
import { prediosComProblemas } from "@/components/imoveis/modelo";
import { Bloco, Lede, Money, Pilulas } from "@/components/kit";
import { geoOptionsFromBenchmarks } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { nomeProprio } from "@/lib/format";
import { getSnapshot } from "@/lib/portfolio";
import { fetchGeoOptions } from "@/lib/portfolio/load";
import { carregarEntradaDeProblemas } from "@/lib/portfolio/problemas-load";

export const dynamic = "force-dynamic";

async function NovaFracao() {
  const [{ supabase }, snap] = await Promise.all([getSession(), getSnapshot()]);
  const landlords = Array.from(new Map(snap.ativos.flatMap((a) =>
    a.titulares.map((t) => [t.landlord.id, { ...t.landlord, name: nomeProprio(t.landlord.name) }] as const),
  )).values()).sort((a, b) => a.name.localeCompare(b.name, "pt"));
  return <PropertyFormButton landlords={landlords} geoOptions={geoOptionsFromBenchmarks(await fetchGeoOptions(supabase))} />;
}

export default async function Imoveis({ searchParams }: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const [sp, { isAdmin, supabase }, snap] = await Promise.all([searchParams, getSession(), getSnapshot()]);
  const entrada = await carregarEntradaDeProblemas(supabase, snap, snap.hoje);
  const todos = prediosComProblemas(entrada);
  const comProblemas = todos.filter((p) => p.comProblemas);
  const vagos = todos.filter((p) => p.correntes > p.arrendadas);
  const ver = sp.ver === "problemas" || sp.ver === "vagos" ? sp.ver : "todos";
  const visiveis = ver === "problemas" ? comProblemas : ver === "vagos" ? vagos : todos;
  const nVagas = snap.correntes.filter((a) => !a.activeContract).length;
  return <div className="mx-auto w-full max-w-2xl space-y-6 tabular-nums">
    <Lede title="Imóveis">{todos.length} {todos.length === 1 ? "prédio" : "prédios"} · {snap.ativos.length} {snap.ativos.length === 1 ? "fração" : "frações"} · {nVagas} {nVagas === 1 ? "vaga" : "vagas"}</Lede>
    <div className="grid grid-cols-2 gap-2.5">
      <Bloco tom={comProblemas.some((p) => p.problemas.some((x) => x.gravidade === 3)) ? "perda" : "neutro"}
        valor={comProblemas.length} rotulo="com problemas" href="/imoveis?ver=problemas" />
      <Bloco tom="tinta" rotulo="Renda por mês" valor={<Money value={todos.reduce((s, p) => s + p.renda, 0)}
        escala="xl" className="text-inherit text-[clamp(1.125rem,5vw,1.5rem)]" />} />
    </div>
    <Pilulas ativo={ver} itens={[
      { id: "todos", rotulo: "Todos", n: todos.length, href: "/imoveis" },
      { id: "problemas", rotulo: "Com problemas", n: comProblemas.length, href: "/imoveis?ver=problemas" },
      { id: "vagos", rotulo: "Vagos", n: vagos.length, href: "/imoveis?ver=vagos" },
    ]} />
    {visiveis.length === 0 ? <div className="vazio rounded-[20px] bg-carta p-5 text-sm text-tinta-2">
      Nenhum imóvel com este filtro. <Link href="/imoveis" className="inline-flex min-h-11 items-center font-semibold text-tinta">Ver todos</Link>
    </div> : <ul className="stagger space-y-3">
      {visiveis.map((p) => <li key={p.chave}><CartaoPredio p={p} problemas={p.problemas}
        back={ver === "todos" ? "/imoveis" : `/imoveis?ver=${ver}`} /></li>)}
    </ul>}
    <nav aria-label="Outras consultas" className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-tinta-2">
      {[["/contratos", "Contratos"], ["/arquivo", "Documentos"], ["/carteira", "Histórico mensal"]].map(([href, nome]) =>
        <Link key={href} href={href} className="inline-flex min-h-11 items-center hover:text-tinta">{nome}</Link>)}
    </nav>
    {isAdmin && await NovaFracao()}
  </div>;
}
