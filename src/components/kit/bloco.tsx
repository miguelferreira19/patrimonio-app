import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TONS = {
  perda: "bg-perda text-papel",
  tinta: "bg-tinta text-papel",
  futuro: "bg-futuro-tenue text-futuro",
  neutro: "bg-carta text-tinta",
};

export function Bloco({
  tom, rotulo, valor, legenda, href, acao, children, tamanho = "caixa", sangra = false,
}: {
  tom: keyof typeof TONS;
  rotulo?: ReactNode;
  valor?: ReactNode;
  legenda?: ReactNode;
  href?: string;
  acao?: ReactNode;
  children?: ReactNode;
  tamanho?: "heroi" | "caixa";
  sangra?: boolean;
}) {
  const heroi = tamanho === "heroi";
  const classes = cn(
    "flex min-w-0 flex-col rounded-[20px]",
    TONS[tom], heroi ? "gap-3.5 px-5 pt-5 pb-[22px]" : "gap-0.5 px-4 py-3.5",
    heroi && sangra && "-mx-5 rounded-t-none",
    href && "cartao-link min-h-11 hover:shadow-none!",
  );
  const conteudo = <>
    <div className="flex min-w-0 flex-col gap-0.5">
      {rotulo != null && <p className={cn("font-semibold", heroi ? "text-base" : "order-2 text-sm")}>{rotulo}</p>}
      {valor != null && <div className={cn("font-display leading-[0.95] tracking-[-0.04em] tabular-nums", heroi ? "text-[clamp(2.5rem,17vw,68px)] font-extrabold" : "text-4xl font-bold")}>{valor}</div>}
      {legenda != null && <p className={cn("text-[13px]", !heroi && "order-3")}>{legenda}</p>}
    </div>
    {children}
    {acao != null && <span className={cn(
      "mt-1 inline-flex min-h-12 items-center justify-center self-start rounded-full px-[18px] text-[15px] font-bold",
      tom === "perda" ? "bg-papel text-perda-forte" : "bg-papel text-tinta",
    )}>{acao}</span>}
  </>;
  return href ? <Link href={href} className={classes}>{conteudo}</Link> : <section className={classes}>{conteudo}</section>;
}
