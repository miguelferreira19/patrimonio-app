"use client";

// A FOLHA (V4, REDESENHO.md §5.6): uma lista ou um formulário que abre por cima, à direita
// no computador e a ocupar o ecrã no telemóvel, sem sair da página.
//
// `<dialog>` nativo com `showModal()`: o browser já dá foco preso, Esc para fechar, o fundo
// inerte e o `::backdrop`. Era o que o `modal.tsx` fazia à mão.
//
// O conteúdo (`children`) vem renderizado do servidor: a folha só o mostra.

import { useRef } from "react";
import { X } from "lucide-react";
import { buttonClass, type ButtonVariant } from "./ui";

export function Folha({
  rotulo,
  titulo,
  subtitulo,
  variante = "outline",
  children,
}: {
  rotulo: string;
  titulo: string;
  subtitulo?: string;
  variante?: ButtonVariant;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={buttonClass({ variant: variante, size: "sm" })}>
        {rotulo}
      </button>
      <dialog
        ref={ref}
        // Clicar no fundo fecha: o alvo do clique é o próprio <dialog> só fora do painel.
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-[440px] bg-carta p-0 text-tinta shadow-[0_0_60px_-10px_rgba(15,21,23,0.35)] backdrop:bg-[rgba(15,21,23,0.35)] open:animate-sheet-in"
      >
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-regua px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-[-0.01em]">{titulo}</h2>
              {subtitulo && <p className="mt-0.5 text-sm text-tinta-2">{subtitulo}</p>}
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Fechar"
              className="grid size-8 shrink-0 place-items-center rounded-full text-tinta-2 hover:bg-vellum hover:text-tinta"
            >
              <X size={18} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      </dialog>
    </>
  );
}
