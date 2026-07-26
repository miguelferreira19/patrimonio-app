// Sem "use client" — ver money.tsx.
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/** Cabeçalho de superfície da V2.
 *
 *  Substitui o `PageHeader` da V1 (que agora delega aqui, para haver UMA
 *  implementação durante a transição). A diferença que importa não é estética: no
 *  modo `hero` o título é uma SERIFA e a descrição é uma frase gerada a partir dos
 *  números, não um rótulo. É o que separa "documento" de "dashboard" (PLANO.md §10.4).
 *
 *  `variant="plain"` é o cabeçalho pequeno das páginas ainda não reescritas.
 */
export function Lede({
  eyebrow,
  title,
  children,
  actions,
  variant = "hero",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** 1 a 3 frases. Nunca um rótulo: se não houver nada a dizer, não passar nada. */
  children?: ReactNode;
  actions?: ReactNode;
  variant?: "hero" | "plain";
  className?: string;
}) {
  const hero = variant === "hero";
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        hero && "animate-rise items-end gap-6",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-acao">{eyebrow}</p>
        )}
        <h1
          className={cn(
            "text-tinta",
            hero
              ? "mt-1.5 font-serif text-[28px] font-normal leading-[1.15] tracking-[-0.01em] md:text-[32px]"
              : "text-xl font-semibold tracking-tight md:text-2xl",
          )}
        >
          {title}
        </h1>
        {children && (
          <p
            className={cn(
              "mt-2 text-tinta-2",
              hero ? "max-w-[62ch] text-base leading-relaxed text-pretty" : "text-sm",
            )}
          >
            {children}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
