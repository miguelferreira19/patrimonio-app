// Sem "use client": nenhuma primitiva do kit usa hooks, e as páginas server têm de
// poder importá-las. Mesma regra (e mesma razão) do ui.tsx — ver CLAUDE.md.
import { splitEur } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/** Tom semântico. Ver PLANO.md §10.2.
 *  `tinta` = valor real, confirmado (o defeito, e a razão de não haver verde de "ok").
 *  `acao`  = dinheiro que só existe se agires (poupança possível, potencial).
 *  `atencao`, `perda`, `futuro` = atenção, perda, estimativa/desconhecido. */
export type Tom = "tinta" | "tinta-2" | "acao" | "atencao" | "perda" | "futuro";

export const TOM_TEXTO: Record<Tom, string> = {
  tinta: "text-tinta",
  "tinta-2": "text-tinta-2",
  acao: "text-acao",
  atencao: "text-atencao",
  perda: "text-perda",
  futuro: "text-futuro",
};

const ESCALA = {
  hero: "text-[44px] leading-none font-serif font-normal tracking-[-0.02em]",
  xl: "text-2xl leading-none font-medium tracking-[-0.01em]",
  lg: "text-base font-medium",
  md: "text-[13px] font-medium",
  sm: "text-xs font-medium",
} as const;

/** Figura monetária. É o objeto de data-viz mais usado da app (PLANO.md §10.6):
 *  magnitude a peso pleno, cêntimos e € esbatidos, sempre `tabular-nums` para as
 *  colunas alinharem pela vírgula sem esforço.
 *
 *  `sign`: mostra "+" em valores positivos. Usar só quando o sinal é a informação
 *  (um potencial, uma poupança, uma variação) — nunca num saldo.
 *  Valor ausente rende "·", a convenção da app para "não sabemos" (nunca 0).
 */
export function Money({
  value,
  decimals = 0,
  escala = "md",
  tom = "tinta",
  sign = false,
  className,
  title,
}: {
  value: number | null | undefined;
  decimals?: 0 | 2;
  escala?: keyof typeof ESCALA;
  tom?: Tom;
  sign?: boolean;
  className?: string;
  title?: string;
}) {
  const parts = splitEur(value, decimals);
  const classes = cn("tabular-nums whitespace-nowrap", ESCALA[escala], TOM_TEXTO[tom], className);

  if (!parts) {
    return (
      <span className={classes} title={title ?? "Sem dados"}>
        ·
      </span>
    );
  }

  const prefix = sign && typeof value === "number" && value > 0 ? "+" : "";
  return (
    <span className={classes} title={title}>
      {prefix}
      {parts.major}
      <span className="money-minor">{parts.minor}</span>
    </span>
  );
}

/** Número não monetário com unidade (m², %, meses, contratos).
 *  Existe para que uma percentagem e um euro não sejam desenhados da mesma forma:
 *  a unidade fica esbatida, o número não. */
export function Figure({
  value,
  unit,
  escala = "md",
  tom = "tinta",
  className,
  title,
}: {
  value: ReactNode;
  unit?: ReactNode;
  escala?: keyof typeof ESCALA;
  tom?: Tom;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn("tabular-nums whitespace-nowrap", ESCALA[escala], TOM_TEXTO[tom], className)}
      title={title}
    >
      {value}
      {unit != null && <span className="money-minor">&nbsp;{unit}</span>}
    </span>
  );
}
