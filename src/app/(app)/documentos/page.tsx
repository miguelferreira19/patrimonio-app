import Link from "next/link";
import { FileText, FolderOpen, TriangleAlert } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Carregar, type FracaoOpcao } from "@/components/documentos/carregar";
import { ApagarDocumento, EscolherCarta, EscolherMinuta, type ContratoOpcao } from "@/components/documentos/acoes";
import { getSession } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { BUCKET, GERAL, partirCaminho } from "@/lib/documentos";
import type { Contract, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

// O ARQUIVO (V3, 2026-07-30). Um sítio só para os papéis da carteira: os PDFs que estavam
// a viver na pasta `dados/` do repo (cadernetas prediais, declarações de IRS), os contratos
// de arrendamento à medida que forem chegando, e as minutas que a app escreve sozinha.
//
// Toda a família LÊ; só o admin arquiva e apaga (é a política do bucket, não só a UI).
//
// Nota de I/O: a listagem é UM `list()` sobre a raiz do bucket, porque os caminhos são
// planos (`<artigo matricial>__<ficheiro>`, ver lib/documentos.ts). Com pastas a sério
// seriam ~50 pedidos, um por fração.

/** Uma hora chega para ler ou descarregar; renova-se a cada visita à página. */
const VALIDADE_LINK = 3600;

function tamanho(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

export default async function DocumentosPage() {
  const { supabase, isAdmin } = await getSession();

  const [propsQ, contratosQ, listaQ] = await Promise.all([
    supabase.from("properties").select("*").order("name"),
    supabase.from("contracts").select("*"),
    supabase.storage.from(BUCKET).list("", { limit: 1000, sortBy: { column: "name", order: "asc" } }),
  ]);

  const properties = (propsQ.data ?? []) as Property[];
  const contracts = (contratosQ.data ?? []) as Contract[];
  const propByMatriz = new Map(
    properties.filter((p) => p.matriz_article).map((p) => [p.matriz_article!, p]),
  );

  const fracoes: FracaoOpcao[] = properties
    .filter((p) => p.matriz_article)
    .map((p) => ({ matriz: p.matriz_article!, label: `${p.name} · ${p.matriz_article}` }));

  const propById = new Map(properties.map((p) => [p.id, p]));
  const contratos: ContratoOpcao[] = contracts
    .filter((c) => c.status === "ativo")
    .map((c) => ({
      id: c.id,
      label: `${propById.get(c.property_id)?.name ?? "Fração"} · ${c.tenant_name}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt"));

  // O bucket é criado à mão no SQL Editor (bloco "V3 · DOCUMENTOS" no fim do schema.sql),
  // como todas as migrações deste projeto. Enquanto não for, dizê-lo em vez de mostrar um
  // arquivo vazio que parece estar a funcionar.
  const semBucket = !!listaQ.error;

  const ficheiros = (listaQ.data ?? [])
    .filter((o) => o.id && o.name !== ".emptyFolderPlaceholder")
    .map((o) => ({
      path: o.name,
      ...partirCaminho(o.name),
      atualizado: (o.updated_at ?? o.created_at ?? null) as string | null,
      bytes: (o.metadata?.size ?? null) as number | null,
    }));

  const urlPorPath = new Map<string, string>();
  if (ficheiros.length > 0) {
    const { data: urls } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(ficheiros.map((f) => f.path), VALIDADE_LINK);
    for (const u of urls ?? []) if (u.signedUrl) urlPorPath.set(u.path ?? "", u.signedUrl);
  }

  const porEscopo = new Map<string, typeof ficheiros>();
  for (const f of ficheiros) porEscopo.set(f.escopo, [...(porEscopo.get(f.escopo) ?? []), f]);

  function titulo(escopo: string): string {
    if (escopo === GERAL) return "Geral (carteira toda)";
    const p = propByMatriz.get(escopo);
    return p ? `${p.name} · ${escopo}` : escopo;
  }

  // Geral primeiro (é onde ficam as declarações e a correspondência da família), depois as
  // frações por nome.
  const grupos = Array.from(porEscopo.keys()).sort((a, b) => {
    if (a === GERAL) return -1;
    if (b === GERAL) return 1;
    return titulo(a).localeCompare(titulo(b), "pt");
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Documentos"
        description="O arquivo da carteira: contratos, cadernetas prediais, declarações e as minutas que a app escreve."
      />

      {semBucket && (
        <Card title="Falta criar o arquivo">
          <EmptyState icon={TriangleAlert}>
            O bucket <code className="font-mono">documentos</code> ainda não existe. Colar no SQL
            Editor do Supabase o bloco &quot;V3 · DOCUMENTOS&quot; do fim de{" "}
            <code className="font-mono">supabase/schema.sql</code>.
          </EmptyState>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Minutas"
          subtitle="escolhe o contrato e a app escreve a carta com os dados dele"
        >
          <EscolherMinuta contratos={contratos} />
          <div className="mt-4 border-t border-regua pt-3">
            <p className="text-sm font-medium text-tinta">Atualização de renda</p>
            <p className="mb-2 text-xs text-tinta-2">
              Tem rota própria: depende do coeficiente do ano e de o contrato já ser elegível.
            </p>
            <EscolherCarta contratos={contratos} />
          </div>
        </Card>

        {isAdmin && !semBucket && <Carregar fracoes={fracoes} />}
      </div>

      {!semBucket && grupos.length === 0 ? (
        <Card>
          <EmptyState icon={FolderOpen}>
            Ainda não há documentos arquivados.
            {isAdmin
              ? " Larga acima as cadernetas prediais e os contratos de arrendamento."
              : " O administrador ainda não arquivou nada."}
          </EmptyState>
        </Card>
      ) : (
        grupos.map((escopo) => {
          const lista = porEscopo.get(escopo)!;
          const p = propByMatriz.get(escopo);
          return (
            // O `id` é o alvo do link "Documentos" da ficha da fração (`/documentos#<artigo>`).
            <div key={escopo} id={escopo} className="scroll-mt-24">
            <Card
              title={
                p ? (
                  <Link href={`/fracoes/${p.id}`} className="hover:text-acao">
                    {titulo(escopo)}
                  </Link>
                ) : (
                  titulo(escopo)
                )
              }
              subtitle={`${lista.length} ${lista.length === 1 ? "documento" : "documentos"}`}
            >
              <ul className="divide-y divide-regua">
                {lista.map((f) => {
                  const url = urlPorPath.get(f.path);
                  return (
                    <li key={f.path} className="flex items-center gap-3 py-2">
                      <FileText size={15} strokeWidth={1.5} className="shrink-0 text-tinta-3" />
                      <div className="min-w-0 flex-1">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-sm text-tinta hover:text-acao hover:underline"
                          >
                            {f.nome}
                          </a>
                        ) : (
                          <span className="block truncate text-sm text-tinta-2">{f.nome}</span>
                        )}
                        <p className="text-[11px] text-tinta-3">
                          {[tamanho(f.bytes), f.atualizado ? fmtDate(f.atualizado.slice(0, 10)) : ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {isAdmin && <ApagarDocumento path={f.path} nome={f.nome} />}
                    </li>
                  );
                })}
              </ul>
            </Card>
            </div>
          );
        })
      )}
    </div>
  );
}
