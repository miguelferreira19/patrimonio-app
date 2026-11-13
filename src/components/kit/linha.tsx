import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TONS = { tinta: "text-tinta", perda: "text-perda", futuro: "text-futuro", neutro: "text-tinta" };

export function Linha({ href, titulo, sub, valor, etiqueta, tom = "tinta", children }: {
  href?: string;
  titulo: ReactNode;
  sub?: ReactNode;
  valor?: ReactNode;
  etiqueta?: ReactNode;
  tom?: keyof typeof TONS;
  children?: ReactNode;
}) {
  const classes = cn("flex min-h-14 min-w-0 flex-col justify-center gap-2 py-2 text-tinta", href && "cartao-link hover:shadow-none!");
  const conteudo = <>
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className="text-base font-semibold [overflow-wrap:anywhere]">{titulo}</p>
        {sub != null && <p className="mt-0.5 text-[13px] text-tinta-2">{sub}</p>}
      </div>
      {valor != null && <div className={cn("shrink-0 font-display text-lg font-bold tabular-nums", TONS[tom])}>{valor}</div>}
    </div>
    {etiqueta != null && <div className={cn("text-[13px] font-semibold", TONS[tom])}>{etiqueta}</div>}
    {children}
  </>;
  return href ? <Link href={href} className={classes}>{conteudo}</Link> : <div className={classes}>{conteudo}</div>;
}
