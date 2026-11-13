// Sem "use client" — ver money.tsx.
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function Seccao({
  titulo,
  valor,
  nota,
  id,
  className,
  children,
}: {
  titulo: string;
  /** À direita do título: um total, uma leitura, uma legenda. Já formatado. */
  valor?: ReactNode;
  nota?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <header className="mb-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-bold tracking-[-0.01em] text-tinta">
            {titulo}
          </h2>
          {valor}
        </div>
        {nota && <p className="mt-1 max-w-[75ch] text-xs text-tinta-3">{nota}</p>}
      </header>
      {children}
    </section>
  );
}
