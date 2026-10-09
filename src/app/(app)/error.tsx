"use client";

// O que se vê quando uma leitura falha (2026-10-03).
//
// Existe porque as leituras deixaram de engolir erros (`lib/supabase/dados.ts`): uma
// falha do Supabase lança, em vez de desenhar uma carteira vazia que parecia verdade.
// Lançar precisa de um sítio onde cair, e a página genérica do Next era em inglês e
// sem caminho de volta.
//
// Fica DENTRO do layout do grupo, por isso o masthead continua lá e a família pode
// mudar de página sem recarregar a app.

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { buttonClass } from "@/components/ui";

export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[página]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-perda">
        Não foi possível ler os dados
      </p>
      <h1 className="mt-2 font-serif text-3xl text-tinta">Esta página não carregou.</h1>
      <p className="mt-3 text-sm leading-relaxed text-tinta-2">
        Não foi possível apresentar os dados desta página. Tenta novamente. Se o problema
        persistir, guarda a referência abaixo para o administrador verificar.
      </p>
      {/* Em produção o Next esconde a mensagem e dá só o digest, que é o que se procura
          nos logs da Vercel. */}
      <p className="mt-3 font-mono text-xs text-tinta-3">
        {error.digest ? `Referência ${error.digest}` : error.message}
      </p>
      <button type="button" onClick={reset} className={buttonClass({ className: "mt-6" })}>
        <RotateCcw size={16} aria-hidden="true" />
        Tentar de novo
      </button>
    </div>
  );
}
