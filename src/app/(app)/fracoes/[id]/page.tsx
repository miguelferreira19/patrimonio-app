import Link from "next/link";
import { CabecalhoFracao } from "@/components/fracao/cabecalho";
import { carregarFracao } from "@/components/fracao/dados";
import { ResumoFracao } from "@/components/fracao/resumo";
import { PagamentosFracao } from "@/components/fracao/pagamentos";
import { ContratoFracao } from "@/components/fracao/contrato";
import { DocumentosFracao } from "@/components/fracao/documentos";
import { DespesasFracao } from "@/components/fracao/despesas";
import { NavegacaoFracao, TABS } from "@/components/fracao/navegacao";
import { chaveDoPredio, normalizarMorada } from "@/lib/portfolio/predios";

export const dynamic = "force-dynamic";

export default async function FracaoPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; voltar?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const back = query.voltar && /^\/(?:imoveis|carteira)(?:[/?]|$)/.test(query.voltar) ? query.voltar : "/imoveis";
  const tab = TABS.some(([k]) => k === query.tab) ? query.tab! : "resumo";
  const dados = await carregarFracao(id);
  const { chave } = chaveDoPredio(dados.property.matriz_article, id);
  return <div className="mx-auto w-full max-w-2xl space-y-6 tabular-nums">
    <nav aria-label="Localização" className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-3">
      <Link href={back} className="inline-flex min-h-11 items-center text-tinta-2">Imóveis</Link>
      <span>/</span>
      <Link href={"/imoveis/" + encodeURIComponent(chave)} className="inline-flex min-h-11 items-center text-tinta-2">
        {normalizarMorada(dados.property.address) ?? "Prédio"}
      </Link>
    </nav>
    <CabecalhoFracao dados={dados} />
    <NavegacaoFracao dados={dados} tab={tab} voltar={back} />
    {tab === "resumo" && <ResumoFracao dados={dados} voltar={back} />}
    {tab === "pagamentos" && <PagamentosFracao dados={dados} />}
    {tab === "contrato" && <ContratoFracao dados={dados} />}
    {tab === "documentos" && <DocumentosFracao dados={dados} />}
    {tab === "despesas" && <DespesasFracao dados={dados} />}
  </div>;
}
