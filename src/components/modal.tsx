"use client";

// O Modal vive num ficheiro PRÓPRIO, e não no ui.tsx, porque precisa de hooks.
// O ui.tsx é módulo partilhado (server + client) e marcá-lo como client cria uma
// fronteira de serialização que faz TODAS as páginas server crasharem em runtime ao
// passarem `icon={LucideIcon}` — foi o hotfix de 2026-07-20, ver CLAUDE.md.
// O ui.tsx re-exporta este componente, por isso os importadores não mudam.

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

const FOCUSAVEL =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const painel = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);

  // Esc para fechar + trava de scroll do fundo + devolver o foco a quem abriu.
  // Sem isto, o teclado continua a andar pela página por trás do modal e a página
  // salta para o topo ao fechar.
  useEffect(() => {
    if (!open) return;

    focoAnterior.current = document.activeElement as HTMLElement | null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Foco inicial. A ordem importa e já causou uma regressão: se este efeito focar
    // cegamente o primeiro elemento focável, rouba o foco ao campo com `autoFocus`
    // (a grelha de Pagamentos conta com isso para se escrever o valor logo) e o
    // primeiro focável em ordem de DOM é o X de fechar, que é o pior alvo possível.
    // Por isso: 1) se o React já pôs o foco dentro do painel, não mexer;
    //           2) senão, o primeiro focável que NÃO seja o botão de fechar;
    //           3) em último recurso, o próprio painel.
    const jaTemFoco =
      document.activeElement instanceof HTMLElement &&
      painel.current?.contains(document.activeElement);
    if (!jaTemFoco) {
      const candidatos = Array.from(
        painel.current?.querySelectorAll<HTMLElement>(FOCUSAVEL) ?? [],
      ).filter((el) => el.dataset.modalClose === undefined);
      (candidatos[0] ?? painel.current)?.focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !painel.current) return;
      // Trava de foco: o Tab circula dentro do painel em vez de sair para trás.
      const alvos = Array.from(painel.current.querySelectorAll<HTMLElement>(FOCUSAVEL)).filter(
        (el) => el.offsetParent !== null,
      );
      if (alvos.length === 0) return;
      const primeiroAlvo = alvos[0];
      const ultimoAlvo = alvos[alvos.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiroAlvo || ativo === painel.current)) {
        e.preventDefault();
        ultimoAlvo.focus();
      } else if (!e.shiftKey && ativo === ultimoAlvo) {
        e.preventDefault();
        primeiroAlvo.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflowAnterior;
      focoAnterior.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex justify-end bg-[rgba(15,21,23,0.35)]"
      onMouseDown={(e) => {
        // Fechar ao clicar fora, mas só quando o gesto COMEÇA no fundo — senão um
        // arrasto que termina fora do painel fecharia o modal a meio da seleção.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* V4 (REDESENHO.md §5.6): o modal passou a FOLHA. Abre à direita, com a altura toda,
          e no telemóvel ocupa o ecrã: um formulário de fração com 15 campos num cartão
          centrado obrigava a fazer scroll dentro de um scroll. Comportamento igual. */}
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        className={cn(
          "animate-sheet-in flex h-dvh w-full flex-col bg-carta shadow-[0_0_60px_-10px_rgba(15,21,23,0.35)] outline-none",
          wide ? "max-w-3xl" : "max-w-[480px]",
        )}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-regua px-5 py-4">
          <h3 className="text-lg font-semibold tracking-[-0.01em] text-tinta">{title}</h3>
          <button
            onClick={onClose}
            data-modal-close=""
            className="grid size-8 place-items-center rounded-full text-tinta-2 transition-colors hover:bg-vellum hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
