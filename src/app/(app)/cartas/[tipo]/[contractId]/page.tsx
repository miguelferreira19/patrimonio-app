import Link from "next/link";
import { notFound } from "next/navigation";
import { Lede } from "@/components/kit";
import { buttonClass } from "@/components/ui";
import { CopiarMensagem, MarcarEnviada } from "@/components/cartas/acoes";
import { carregarCarta, construirCarta, tipoDeCarta, type QueryCarta } from "@/components/cartas/dados";
import { LeituraCarta, PlanoAcordo } from "@/components/cartas/leitura";
import { getSession } from "@/lib/data";
import { MINUTAS, textoCurto } from "@/lib/minutas";
import { planoDoAcordo } from "@/lib/portfolio/cartas-diario";

export const dynamic = "force-dynamic";

export default async function CartaPage({ params, searchParams }: {
  params: Promise<{ tipo: string; contractId: string }>; searchParams: Promise<QueryCarta>;
}) {
  const [{ tipo, contractId }, query, { isGestor }] = await Promise.all([params, searchParams, getSession()]);
  if (!tipoDeCarta(tipo)) notFound();
  const contexto = await carregarCarta(contractId);
  if (!contexto) notFound();
  if (!contexto.dados) return <div className="vazio rounded-2xl bg-carta p-5 text-base">Sem senhorio associado</div>;
  const dados = contexto.dados;
  const spec = MINUTAS[tipo];
  let minuta;
  try { minuta = construirCarta(tipo, dados, query); }
  catch (error) {
    return <div className="mx-auto w-full max-w-2xl space-y-5">
      <Lede title={spec.label} /><PlanoAcordo query={query} hoje={dados.hoje} />
      <div role="alert" className="vazio text-base text-perda">{error instanceof Error ? error.message : "Plano inválido"}</div>
    </div>;
  }
  const pesquisa = tipo === "acordo" ? `?${new URLSearchParams(Object.entries(planoDoAcordo(query, dados.hoje))
    .map(([k, v]) => [k, String(v)]))}` : "";
  return <div className="mx-auto w-full max-w-2xl space-y-5 tabular-nums">
    <Link href="/cartas" className="inline-flex min-h-11 items-center text-sm font-semibold">‹ Cartas</Link>
    <Lede title={spec.label} />
    <LeituraCarta minuta={minuta} dados={dados} />
    {tipo === "acordo" && <PlanoAcordo query={query} hoje={dados.hoje} />}
    <div className="space-y-2 text-base text-tinta-2">
      <p>{minuta.nota}</p>
      <div>{spec.envio === "registada" ? "Carta registada com aviso de receção" : "Carta simples"}</div>
    </div>
    <a href={`/api/minuta/${tipo}/${contractId}${pesquisa}`} className={buttonClass()}>Descarregar .docx</a>
    {tipo === "lembrete" && <CopiarMensagem texto={textoCurto("lembrete", dados, dados.divida!)} />}
    {isGestor && <MarcarEnviada contractId={contractId} tipo={tipo} rotulo={spec.label} hoje={dados.hoje} />}
  </div>;
}
