"use client";

// A lista do ARQUIVO com pesquisa e filtro por tipo (V4 F7). Filtra no browser: o arquivo
// tem dezenas de ficheiros, não milhares, e a lista já veio inteira do servidor.
import { useState } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { cn } from "@/components/ui";
import { TIPO_DOCUMENTO_LABEL, type TipoDocumento } from "@/lib/documentos";
import { normalizar } from "@/lib/portfolio/pesquisa";

export interface ItemArquivo {
  path: string;
  nome: string;
  onde: string;
  ondeHref: string | null;
  url: string | null;
  tipo: TipoDocumento;
  atualizado: string | null;
}

export function ArquivoLista({ itens }: { itens: ItemArquivo[] }) {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<TipoDocumento | "todos">("todos");
  const termos = normalizar(q).split(" ").filter(Boolean);
  const visiveis = itens.filter(
    (i) =>
      (tipo === "todos" || i.tipo === tipo) &&
      termos.every((t) => normalizar(`${i.nome} ${i.onde}`).includes(t)),
  );
  const tipos = (Object.keys(TIPO_DOCUMENTO_LABEL) as TipoDocumento[]).filter((t) => itens.some((i) => i.tipo === t));

  return (
    <div className="space-y-4">
      <label className="flex h-11 items-center gap-2.5 rounded-full border border-regua-forte bg-carta px-4 focus-within:ring-2 focus-within:ring-acao">
        <Search size={16} className="shrink-0 text-tinta-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Procurar por nome, fração ou rua…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-tinta-3"
        />
      </label>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {(["todos", ...tipos] as Array<TipoDocumento | "todos">).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            aria-pressed={tipo === t}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
              tipo === t ? "border-tinta bg-tinta text-papel" : "border-regua bg-carta text-tinta-2 hover:border-regua-forte",
            )}
          >
            {t === "todos" ? "Todos" : TIPO_DOCUMENTO_LABEL[t]}
            <span className="ml-1.5 tabular-nums opacity-60">
              {t === "todos" ? itens.length : itens.filter((i) => i.tipo === t).length}
            </span>
          </button>
        ))}
      </div>
      {visiveis.length === 0 ? (
        <p className="rounded-2xl border border-regua bg-carta px-5 py-8 text-center text-sm text-tinta-2">Nenhum documento.</p>
      ) : (
        <ul className="divide-y divide-regua overflow-hidden rounded-2xl border border-regua bg-carta">
          {visiveis.map((i) => (
            <li key={i.path} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-vellum text-tinta-3">
                <FileText size={16} />
              </span>
              <div className="min-w-0 flex-1">
                {i.url ? (
                  <a href={i.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-tinta hover:text-acao">
                    {i.nome}
                  </a>
                ) : (
                  <span className="block truncate text-sm font-medium text-tinta">{i.nome}</span>
                )}
                <span className="block truncate text-xs text-tinta-3">
                  {i.ondeHref ? (
                    <Link href={i.ondeHref} className="hover:text-tinta-2">
                      {i.onde}
                    </Link>
                  ) : (
                    i.onde
                  )}
                  {i.atualizado && ` · ${new Date(i.atualizado).toLocaleDateString("pt-PT")}`}
                </span>
              </div>
              <span className="hidden shrink-0 rounded-full bg-vellum px-2 py-0.5 text-[11px] font-medium text-tinta-2 sm:inline">
                {TIPO_DOCUMENTO_LABEL[i.tipo]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
