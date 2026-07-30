"use client";

// Ações de admin sobre um ficheiro arquivado.
//
// O `EscolherMinuta` que aqui vivia foi apagado a 2026-07-30: escolhia o CONTRATO numa
// lista própria e oferecia as cinco cartas a toda a gente, sempre. A página passou a ser
// por FRAÇÃO (uma escolha só, no URL) e as cartas passaram a ser filtradas pelo
// enquadramento — a lista está agora na própria página, alimentada por
// `enquadrarMinutas` (lib/minutas.ts).

import { Trash2 } from "lucide-react";
import { useAction } from "@/components/forms";
import { apagarDocumento } from "@/lib/actions/documentos";

export function ApagarDocumento({ path, nome }: { path: string; nome: string }) {
  const { pending, error, run } = useAction();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        title="Apagar"
        onClick={() => {
          if (confirm(`Apagar "${nome}"? Não há forma de recuperar.`)) void run(apagarDocumento(path));
        }}
        className="rounded-lg p-1.5 text-tinta-3 transition-colors hover:bg-perda-tenue hover:text-perda disabled:opacity-50"
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </button>
      {error && <span className="text-xs text-perda">{error}</span>}
    </>
  );
}
