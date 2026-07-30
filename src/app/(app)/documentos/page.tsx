import Link from "next/link";
import { Download, FileSignature, FolderOpen, TriangleAlert } from "lucide-react";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import { Lede, PropertyStatusBadge, Seccao } from "@/components/kit";
import { Carregar, type FracaoOpcao } from "@/components/documentos/carregar";
import { SeletorFracao, type FracaoItem } from "@/components/documentos/seletor";
import { ListaDocumentos, lerArquivo, type DocumentoArquivado } from "@/components/documentos/lista";
import { getSession } from "@/lib/data";
import { getSnapshot } from "@/lib/portfolio";
import { GERAL, escopoSeguro } from "@/lib/documentos";
import { enquadrarMinutas } from "@/lib/minutas";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// DOCUMENTOS (V3, reescrito a 2026-07-30). Uma fração de cada vez, e só o que lhe diz
// respeito:
//
//   1. MINUTAS — as cartas que a app escreve, filtradas pelo enquadramento do contrato.
//      Uma oposição à renovação nos primeiros três anos é ineficaz e uma atualização de
//      renda sem elegibilidade é uma carta que se pode ignorar: oferecê-las é afirmar que
//      se aplicam. A regra é pura e está testada em `lib/minutas.check.ts`.
//   2. DOCUMENTOS DA FRAÇÃO — o arquivo daquele artigo matricial: contrato de
//      arrendamento, caderneta predial, o que mais lá estiver.
//
// O arquivo GERAL (declarações de IRS, correspondência da família) é só de ADMIN e fica
// no fim, depois de uma fronteira: não é informação de fração nenhuma, e a página é para
// a família inteira.
//
// A fração escolhida vive no URL (`?fracao=`), como as lentes da Carteira.

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ fracao?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, isAdmin } = await getSession();
  const [snap, arquivo] = await Promise.all([getSnapshot(), lerArquivo(supabase)]);

  const ativos = snap.ativos
    .slice()
    .sort((a, b) => a.property.name.localeCompare(b.property.name, "pt"));

  // Índice do bucket por escopo. `escopoSeguro` dos dois lados: o artigo matricial chega
  // da ficha com `º` e espaços, e o caminho no Storage já vem higienizado — comparar o
  // cru com o higienizado era o que fazia a caderneta de `182341-U-4260-1ºPES` parecer
  // órfã.
  const porEscopo = new Map<string, DocumentoArquivado[]>();
  for (const d of arquivo.docs) {
    const lista = porEscopo.get(d.escopo);
    if (lista) lista.push(d);
    else porEscopo.set(d.escopo, [d]);
  }
  const docsDe = (matriz: string | null): DocumentoArquivado[] =>
    matriz ? porEscopo.get(escopoSeguro(matriz)) ?? [] : [];

  const escoposDasFracoes = new Set(
    ativos.map((a) => a.property.matriz_article).filter(Boolean).map((m) => escopoSeguro(m!)),
  );
  // Geral, mais o que ficou arquivado num artigo que nenhuma fração tem. Os órfãos não
  // podem viver só na ficha de uma fração que não existe: desapareciam do arquivo.
  const gerais = arquivo.docs.filter(
    (d) => d.escopo === GERAL || !escoposDasFracoes.has(d.escopo),
  );
  const emFracoes = arquivo.docs.length - gerais.length;

  if (ativos.length === 0) {
    return (
      <div className="space-y-6">
        <Lede eyebrow="Arquivo" title="Documentos">
          Ainda não há frações na carteira. Os documentos arquivam-se por fração.
        </Lede>
      </div>
    );
  }

  const opcoes: FracaoItem[] = ativos.map((a) => {
    const n = docsDe(a.property.matriz_article).length;
    return {
      id: a.property.id,
      nome: a.property.name,
      detalhe: n === 1 ? "1 documento" : n > 0 ? `${n} documentos` : "",
    };
  });

  const escolhida = ativos.find((a) => a.property.id === sp.fracao) ?? ativos[0];
  const { property, activeContract: contrato } = escolhida;
  const docs = docsDe(property.matriz_article);

  const minutas = enquadrarMinutas({
    hoje: snap.hoje,
    temContratoAtivo: contrato !== null,
    inicioContrato: contrato?.start_date ?? null,
    rendaElegivel: escolhida.rendaAtualizavel?.eligible ?? false,
    rendaElegivelDesde: escolhida.rendaAtualizavel?.eligibleSince ?? null,
    // Sem coeficiente registado o `rentUpdateEligibility` não consegue sugerir renda —
    // é o mesmo facto, e evita uma segunda leitura da tabela só para o confirmar.
    temCoeficiente: (escolhida.rendaAtualizavel?.suggestedRent ?? null) !== null,
    // Um contrato de ritmo próprio (trimestral, por exemplo) não está em atraso: é a
    // mesma exclusão que a página de Atrasos faz no total da carteira.
    mesesEmAtraso:
      escolhida.arrears && escolhida.arrears.severity !== "ritmo_proprio"
        ? escolhida.arrears.streak
        : 0,
  });
  const disponiveis = minutas.filter((m) => m.bloqueio === null);
  const bloqueadas = minutas.filter((m) => m.bloqueio !== null);

  const morada =
    [property.address, property.parish, property.municipality].filter(Boolean).join(" · ") ||
    "Sem morada na ficha";

  const fracoesParaUpload: FracaoOpcao[] = ativos
    .filter((a) => a.property.matriz_article)
    .map((a) => ({
      matriz: a.property.matriz_article!,
      label: `${a.property.name} · ${a.property.matriz_article}`,
    }));
  const destino: FracaoOpcao | undefined = property.matriz_article
    ? { matriz: property.matriz_article, label: property.name }
    : undefined;

  return (
    <div className="space-y-8">
      <Lede
        eyebrow="Arquivo"
        title={
          arquivo.docs.length === 0 ? (
            "Documentos"
          ) : (
            <>
              <span className="tabular-nums">{emFracoes}</span> documentos nas frações
            </>
          )
        }
      >
        As cartas que se aplicam a cada fração e os papéis que estão arquivados nela.
      </Lede>

      {arquivo.erro && (
        <Card title="Falta criar o arquivo">
          <EmptyState icon={TriangleAlert}>
            O bucket <code className="font-mono">documentos</code> ainda não existe. Colar no SQL
            Editor do Supabase o bloco &quot;V3 · DOCUMENTOS&quot; do fim de{" "}
            <code className="font-mono">supabase/schema.sql</code>.
          </EmptyState>
        </Card>
      )}

      {/* A escolha e a identidade da fração escolhida, numa só barra. Fica em cartão (é o
          único controlo da página, e é onde a mão vai primeiro); o resto são secções. */}
      <div className="rounded-xl border border-regua bg-carta">
        <div className="border-b border-regua px-4 py-3">
          <SeletorFracao fracoes={opcoes} valor={property.id} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-tinta">{property.name}</p>
            <p className="mt-0.5 truncate text-xs text-tinta-2">{morada}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PropertyStatusBadge status={property.status} />
            {property.matriz_article ? (
              <Badge tone="neutro" className="font-mono">
                {property.matriz_article}
              </Badge>
            ) : (
              <Badge tone="atencao">Sem artigo matricial</Badge>
            )}
            <Link
              href={`/fracoes/${property.id}`}
              className="text-xs font-medium text-acao hover:underline"
            >
              Abrir a ficha
            </Link>
          </div>
        </div>
      </div>

      <Seccao
        titulo="Minutas"
        valor={
          contrato ? (
            <span className="text-xs text-tinta-3">
              {contrato.tenant_name}
              {contrato.start_date ? ` · desde ${fmtDate(contrato.start_date)}` : ""}
            </span>
          ) : undefined
        }
        nota="Cartas geradas com os dados do contrato, em Word para acabar de preencher. Só aparecem as que se aplicam a esta fração."
      >
        {disponiveis.length === 0 ? (
          <EmptyState icon={FileSignature}>
            {contrato
              ? "Nenhuma carta se aplica a este contrato neste momento."
              : "Sem contrato ativo: as cartas identificam um arrendatário e um locado que esta fração não tem."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-regua border-y border-regua">
            {disponiveis.map((m) => (
              <li key={m.chave} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-tinta">{m.label}</p>
                  <p className="mt-0.5 text-xs text-tinta-2">{m.descricao}</p>
                  <p className="mt-1 text-[11px] text-tinta-3">{m.base}</p>
                </div>
                <a
                  href={`/api/minuta/${m.chave}/${contrato!.id}`}
                  className={buttonClass({ variant: "outline", size: "sm" })}
                >
                  <Download size={14} strokeWidth={1.75} />
                  Word
                </a>
              </li>
            ))}
          </ul>
        )}

        {bloqueadas.length > 0 && (
          // R3: o porquê não está sempre ligado. Esconder as cartas que não se aplicam é
          // o pedido; esconder a RAZÃO seria deixar quem procura a atualização de renda
          // sem saber se ela não existe ou se a app se enganou.
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer list-none text-tinta-3 hover:text-tinta-2">
              {bloqueadas.length === 1
                ? "1 carta não se aplica a esta fração"
                : `${bloqueadas.length} cartas não se aplicam a esta fração`}
            </summary>
            <ul className="mt-2 space-y-1.5 border-l border-regua pl-3">
              {bloqueadas.map((m) => (
                <li key={m.chave} className="text-tinta-3">
                  <span className="text-tinta-2">{m.label}:</span> {m.bloqueio}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Seccao>

      <Seccao
        titulo="Documentos da fração"
        valor={
          docs.length > 0 ? (
            <span className="text-xs tabular-nums text-tinta-3">
              {docs.length === 1 ? "1 ficheiro" : `${docs.length} ficheiros`}
            </span>
          ) : undefined
        }
        nota="Contrato de arrendamento, caderneta predial e o que mais estiver arquivado nesta fração."
      >
        {isAdmin && !arquivo.erro && destino && (
          <div className="mb-3 rounded-lg border border-regua bg-vellum/40 p-2.5">
            <Carregar fracoes={fracoesParaUpload} destino={destino} />
          </div>
        )}
        {!property.matriz_article ? (
          <EmptyState icon={TriangleAlert}>
            Esta fração não tem artigo matricial na ficha, e é o artigo que dá o lugar no
            arquivo.{isAdmin && " Preenche-o na ficha da fração para poder arquivar aqui."}
          </EmptyState>
        ) : docs.length === 0 ? (
          <EmptyState icon={FolderOpen}>
            Nada arquivado nesta fração.
            {isAdmin && " O contrato de arrendamento e a caderneta predial entram aqui."}
          </EmptyState>
        ) : (
          <div className="border-t border-regua">
            <ListaDocumentos docs={docs} isAdmin={isAdmin} />
          </div>
        )}
      </Seccao>

      {/* GERAL: só administrador. Não é informação de fração nenhuma (declarações de IRS,
          correspondência da família) e a página é vista por todos. */}
      {isAdmin && !arquivo.erro && (
        <Seccao
          titulo="Geral (só administrador)"
          valor={
            gerais.length > 0 ? (
              <span className="text-xs tabular-nums text-tinta-3">
                {gerais.length === 1 ? "1 ficheiro" : `${gerais.length} ficheiros`}
              </span>
            ) : undefined
          }
          nota="Papéis da carteira inteira e o que ficou arquivado num artigo que nenhuma fração tem. Arquivar aqui aceita vários ficheiros de uma vez e adivinha a fração pelo nome."
          className="border-t border-regua-forte pt-6"
        >
          <div className="mb-3 rounded-lg border border-regua bg-vellum/40 p-2.5">
            <Carregar fracoes={fracoesParaUpload} />
          </div>
          {gerais.length === 0 ? (
            <EmptyState icon={FolderOpen}>
              Nada arquivado em Geral. As declarações de IRS entram aqui.
            </EmptyState>
          ) : (
            <div className="border-t border-regua">
              <ListaDocumentos docs={gerais} isAdmin={isAdmin} />
            </div>
          )}
        </Seccao>
      )}
    </div>
  );
}
