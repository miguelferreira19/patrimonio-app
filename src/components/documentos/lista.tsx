// A LISTA de documentos arquivados, partilhada pelas duas páginas que a mostram: o
// arquivo geral (`/documentos`) e a ficha de cada fração.
//
// Server component, sem hooks. A leitura do bucket vive aqui em vez de em cada página
// porque é sempre a mesma sequência (um `list()` da raiz, um `createSignedUrls()` em lote)
// e porque a convenção de caminhos plana só é óbvia num sítio: ver `lib/documentos.ts`.

import { FileText } from "lucide-react";
import { ApagarDocumento } from "./acoes";
import { fmtDate } from "@/lib/format";
import { BUCKET, partirCaminho } from "@/lib/documentos";
import type { createClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createClient>>;

/** Uma hora chega para ler ou descarregar; renova-se a cada visita à página. */
const VALIDADE_LINK = 3600;

export interface DocumentoArquivado {
  path: string;
  escopo: string;
  nome: string;
  url: string | null;
  bytes: number | null;
  atualizado: string | null;
}

/** Tudo o que está no bucket, já com links assinados. `erro` é verdadeiro enquanto o
 *  bucket não existir (o bloco "V3 · DOCUMENTOS" do schema.sql ainda por colar) — quem
 *  chama decide se o diz ou se se cala. */
export async function lerArquivo(
  supabase: Cliente,
): Promise<{ erro: boolean; docs: DocumentoArquivado[] }> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) return { erro: true, docs: [] };

  const objetos = (data ?? []).filter((o) => o.id && o.name !== ".emptyFolderPlaceholder");
  if (objetos.length === 0) return { erro: false, docs: [] };

  const { data: urls } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(objetos.map((o) => o.name), VALIDADE_LINK);
  const urlPorPath = new Map<string, string>();
  for (const u of urls ?? []) if (u.signedUrl) urlPorPath.set(u.path ?? "", u.signedUrl);

  return {
    erro: false,
    docs: objetos.map((o) => ({
      path: o.name,
      ...partirCaminho(o.name),
      url: urlPorPath.get(o.name) ?? null,
      bytes: (o.metadata?.size ?? null) as number | null,
      atualizado: (o.updated_at ?? o.created_at ?? null) as string | null,
    })),
  };
}

function tamanho(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

export function ListaDocumentos({
  docs,
  isAdmin,
}: {
  docs: DocumentoArquivado[];
  isAdmin: boolean;
}) {
  return (
    <ul className="divide-y divide-regua">
      {docs.map((f) => (
        <li key={f.path} className="flex items-center gap-3 py-2">
          <FileText size={15} strokeWidth={1.5} className="shrink-0 text-tinta-3" />
          <div className="min-w-0 flex-1">
            {f.url ? (
              <a
                href={f.url}
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
      ))}
    </ul>
  );
}
