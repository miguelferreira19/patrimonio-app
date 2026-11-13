import Link from "next/link";
import { notFound } from "next/navigation";
import { Bloco, Lede, Linha, Money, Seccao, Tira } from "@/components/kit";
import { Badge } from "@/components/ui";
import { tiraDaFracao } from "@/components/imoveis/modelo";
import { ListaProblemas } from "@/components/imoveis/problemas";
import { getSession } from "@/lib/data";
import { nomeProprio } from "@/lib/format";
import { getSnapshot } from "@/lib/portfolio";
import { resumirPredios } from "@/lib/portfolio/imoveis";
import { nomeDaFracao, normalizarMorada } from "@/lib/portfolio/predios";
import { problemasDaFracao } from "@/lib/portfolio/problemas";
import { carregarEntradaDeProblemas } from "@/lib/portfolio/problemas-load";

export const dynamic = "force-dynamic";

export default async function Predio({ params, searchParams }: {
  params: Promise<{ chave: string }>; searchParams: Promise<{ voltar?: string }>;
}) {
  const [{ chave }, q, snap, { supabase }] = await Promise.all([params, searchParams, getSnapshot(), getSession()]);
  const p = resumirPredios(snap).find((x) => x.chave === decodeURIComponent(chave));
  if (!p) notFound();
  const back = q.voltar && /^\/imoveis(?:[/?]|$)/.test(q.voltar) ? q.voltar : "/imoveis";
  const current = `/imoveis/${encodeURIComponent(chave)}?voltar=${encodeURIComponent(back)}`;
  const entrada = await carregarEntradaDeProblemas(supabase, snap, snap.hoje);
  const fracoes = p.fracoes.map((f) => ({ ...f, problemas: problemasDaFracao(f.property.id, entrada) }));
  const problemas = fracoes.flatMap((f) => f.problemas.map((problema) => ({ problema, fracao: nomeDaFracao(f.property) })))
    .sort((a, b) => b.problema.gravidade - a.problema.gravidade || (b.problema.valor ?? 0) - (a.problema.valor ?? 0));
  const titulares = Array.from(new Set(p.fracoes.flatMap((f) => f.titulares.map((t) => nomeProprio(t.landlord.name)))));
  return <div className="mx-auto w-full max-w-2xl space-y-6 tabular-nums">
    <nav aria-label="Localização"><Link href={back} className="inline-flex min-h-11 items-center text-sm text-tinta-2">Imóveis</Link></nav>
    <Lede title={p.nome}>
      {p.morada ?? normalizarMorada(p.fracoes[0]?.property.address)}
      {titulares.length > 0 && <span className="block text-sm">{titulares.join(" · ")}</span>}
    </Lede>
    <div className={`grid gap-2.5 ${p.divida > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
      <Bloco tom="tinta" rotulo="Renda" legenda="por mês" valor={<Money value={p.renda} escala="xl" className="text-inherit" />} />
      {p.divida > 0 && <Bloco tom="perda" rotulo="Em atraso"
        valor={<Money value={p.divida} escala="xl" className="text-inherit" />} />}
    </div>
    <ListaProblemas itens={problemas} />
    <Seccao titulo="Frações">
      {fracoes.length === 0 ? <div className="vazio">Sem frações.</div> : <ul className="stagger divide-y divide-regua rounded-[20px] bg-carta px-4">
        {fracoes.map((f) => <li key={f.property.id}>
          <Linha href={`/fracoes/${f.property.id}?voltar=${encodeURIComponent(current)}`} titulo={f.rotulo}
            sub={f.activeContract ? nomeProprio(f.activeContract.tenant_name) : f.corrente ? "Vaga" : "Fora da carteira corrente"}
            valor={f.activeContract && <Money value={f.activeContract.rent} escala="lg" />}
            etiqueta={f.problemas[0] && <Badge tone={f.problemas[0].gravidade === 3 ? "perda" : "neutro"}>{f.problemas[0].texto}</Badge>}>
            <Tira meses={tiraDaFracao(f, snap)} tamanho="s" />
          </Linha>
        </li>)}
      </ul>}
    </Seccao>
  </div>;
}
