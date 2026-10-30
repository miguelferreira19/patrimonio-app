// Peças dos esqueletos de carregamento (loading.tsx). Sem "use client", sem hooks.
//
// ESTÁTICOS de propósito: nada em loop (sem shimmer nem pulse). A classe `esqueleto` só os
// deixa aparecer depois de ~150ms, para uma navegação rápida não piscar a cinzento. As
// alturas copiam as do conteúdo real, para a página não saltar quando os dados chegam.
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Esqueleto({ children }: { children: ReactNode }) {
  return (
    <div className="esqueleto space-y-8 md:space-y-10" aria-busy="true" aria-label="A carregar">
      <p role="status" className="sr-only">A carregar a página e os dados da carteira.</p>
      {children}
    </div>
  );
}

/** Um traço de texto ou número. */
export function Traco({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-vellum", className)} />;
}

/** Um cartão vazio com a forma do cartão real. */
export function Cartao({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn("rounded-2xl border border-regua bg-carta p-5", className)}>{children}</div>;
}

/** Título de página (h1 de 30px) e a linha por baixo. */
export function Titulo({ sub = true }: { sub?: boolean }) {
  return (
    <div className="space-y-2.5">
      <Traco className="h-8 w-48 md:h-9" />
      {sub && <Traco className="h-4 w-72 max-w-full" />}
    </div>
  );
}
