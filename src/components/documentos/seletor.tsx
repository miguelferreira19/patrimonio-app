"use client";

// O seletor de fração da página de Documentos.
//
// O estado vive no URL (`?fracao=<id>`), como em toda a V2: é partilhável por link,
// sobrevive a um F5 e deixa a página continuar a ser um server component — sem isto, ou
// se renderizavam as ~50 fichas de uma vez para o cliente escolher, ou cada mudança de
// fração era uma ida ao Supabase por cada painel.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

export interface FracaoItem {
  id: string;
  /** Nome da fração. */
  nome: string;
  /** Sufixo discreto na opção: artigo matricial, nº de documentos. */
  detalhe: string;
}

export function SeletorFracao({ fracoes, valor }: { fracoes: FracaoItem[]; valor: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select
        aria-label="Fração"
        aria-busy={pendente}
        value={valor}
        onChange={(e) => {
          const id = e.target.value;
          iniciar(() => router.replace(`/documentos?fracao=${encodeURIComponent(id)}`, { scroll: false }));
        }}
        className="min-w-0 flex-1 sm:max-w-md"
      >
        {fracoes.map((f) => (
          <option key={f.id} value={f.id}>
            {f.detalhe ? `${f.nome} · ${f.detalhe}` : f.nome}
          </option>
        ))}
      </Select>
      {pendente && <span className="shrink-0 text-xs text-tinta-3">a abrir</span>}
    </div>
  );
}
