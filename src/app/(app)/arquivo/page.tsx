// ARQUIVO (V4, REDESENHO.md §4.5). Todos os documentos numa lista com pesquisa e filtro
// por tipo; deixa de ser preciso escolher a fração num menu de 53 para ver um ficheiro.
// Com `?fracao=` mostra a vista de UMA fração (minutas e documentos), que é a página de
// Documentos de sempre.
import { Carregar } from "@/components/documentos/carregar";
import { ArquivoLista, type ItemArquivo } from "@/components/documentos/arquivo-lista";
import { lerArquivo } from "@/components/documentos/lista";
import { getSession } from "@/lib/data";
import { escopoSeguro, tipoDoDocumento } from "@/lib/documentos";
import { getSnapshotLeve } from "@/lib/portfolio";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import DocumentosPage from "../documentos/page";

export const dynamic = "force-dynamic";

export default async function Arquivo({ searchParams }: { searchParams: Promise<{ fracao?: string }> }) {
  const sp = await searchParams;
  if (sp.fracao) return <DocumentosPage searchParams={Promise.resolve({ fracao: sp.fracao })} />;

  const { supabase, isAdmin } = await getSession();
  const [snap, arquivo] = await Promise.all([getSnapshotLeve(), lerArquivo(supabase)]);

  const fracaoPorEscopo = new Map(
    snap.ativos
      .filter((a) => a.property.matriz_article)
      .map((a) => [escopoSeguro(a.property.matriz_article), a.property] as const),
  );
  const itens: ItemArquivo[] = arquivo.docs
    .filter((d) => isAdmin || d.escopo !== "geral")
    .map((d) => {
      const p = fracaoPorEscopo.get(d.escopo);
      return {
        path: d.path,
        nome: d.nome,
        onde: p ? nomeDaFracao(p) : d.escopo === "geral" ? "Geral" : `Artigo ${d.escopo}`,
        ondeHref: p ? `/fracoes/${p.id}?tab=documentos` : null,
        url: d.url,
        tipo: tipoDoDocumento(d.nome),
        atualizado: d.atualizado,
      };
    })
    .sort((a, b) => (b.atualizado ?? "").localeCompare(a.atualizado ?? ""));

  const fracoesParaUpload = snap.ativos
    .filter((a) => a.property.matriz_article)
    .map((a) => ({ matriz: a.property.matriz_article!, label: nomeDaFracao(a.property) }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-tinta-3">Arquivo</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] md:text-[30px]">{arquivo.erro ? "Documentos indisponíveis" : `${itens.length} documentos`}</h1>
        <p className="mt-1.5 text-sm text-tinta-2">
          Cadernetas, contratos, cartas e declarações. As cartas novas geram-se na ficha de cada fração, no separador Contrato.
        </p>
      </header>
      {arquivo.erro ? (
        <p className="rounded-2xl border border-regua bg-carta px-5 py-6 text-sm text-tinta-2">
          Não foi possível carregar o arquivo. Atualiza a página para tentar novamente.{isAdmin && " Se o problema persistir, confirma o acesso ao arquivo na administração do Supabase."}
        </p>
      ) : (
        <>
          {isAdmin && (
            <div className="rounded-2xl border border-dashed border-regua-forte bg-carta p-4">
              <Carregar fracoes={fracoesParaUpload} />
            </div>
          )}
          <ArquivoLista itens={itens} />
        </>
      )}
    </div>
  );
}
