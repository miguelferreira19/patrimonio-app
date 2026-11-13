// Sem "use client": estas primitivas são partilhadas (server + client). Nenhuma usa
// hooks. Marcar este ficheiro como client criaria uma fronteira de serialização e as
// páginas server deixariam de poder passar `icon={LucideIcon}` — crasha em runtime sem
// falhar o build (hotfix de 2026-07-20, ver CLAUDE.md). O Modal, que precisa de hooks
// para Esc/foco/scroll, vive em `./modal` e é re-exportado aqui.
//
// V2: as cores vêm de tokens SEMÂNTICOS (bg-carta, text-tinta, border-regua, text-acao)
// que trocam de par com o tema sozinhos — não há `dark:` nenhum nestas primitivas.
// Ver PLANO.md §10 e o cabeçalho de globals.css.
import { type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Lede } from "./kit/lede";

// Re-exportado para o código que já importa `cn` daqui (nav.tsx, forms.tsx, grelhas…).
export { cn };
export { Modal } from "./modal";

// ---------- Cabeçalho de página ----------
/** @deprecated Usar `Lede` de `@/components/kit`. Fica como adaptador enquanto as
 *  páginas da V1 não passam para as superfícies da V2 (fases 2 a 6 do PLANO.md).
 *  `eyebrow` liga o modo hero, como na V1. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <Lede
      eyebrow={eyebrow}
      title={title}
      actions={actions}
      variant={eyebrow ? "hero" : "plain"}
      className={className}
    >
      {description}
    </Lede>
  );
}

// ---------- Card ----------
export function Card({
  title,
  subtitle,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-[20px] bg-carta", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div>
            {title && <h2 className="font-display text-lg font-semibold text-tinta">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-tinta-2">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4 [&_input.bg-carta]:bg-elevado [&_select.bg-carta]:bg-elevado [&_textarea.bg-carta]:bg-elevado">{children}</div>
    </section>
  );
}

// ---------- Botões ----------
export type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const VARIANTES: Record<ButtonVariant, string> = {
  // primary/danger são superfícies opacas com contraste próprio nos dois temas.
  primary: "bg-acao text-carta hover:bg-acao-forte",
  outline: "bg-carta text-tinta hover:bg-elevado",
  ghost: "text-tinta-2 hover:bg-carta hover:text-tinta",
  danger: "bg-perda text-papel hover:opacity-90",
};

const TAMANHOS: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 text-xs",
  md: "min-h-12 px-[18px] text-[15px]",
};

/** Classes de botão, para os casos em que o elemento NÃO pode ser um <button>:
 *  `<Link>` do Next, `<a href="/api/export">`, `<label>` de input de ficheiro.
 *
 *  Existe para matar as 5 strings de classes copiadas à mão que a V1 tinha espalhadas
 *  (dashboard ×2, atrasos, IRS, admin) — o estilo do CTA passa a ter uma só fonte. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-[color,background-color,transform] duration-150",
    "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta focus-visible:ring-offset-2 focus-visible:ring-offset-papel",
    "disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
    TAMANHOS[size],
    VARIANTES[variant],
    className,
  );
}

interface ButtonComum {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
}

type ButtonProps =
  | (ButtonComum & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { as?: "button" })
  | (ButtonComum & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className"> & { as: "a" });

export function Button(props: ButtonProps) {
  const { variant, size, className, ...rest } = props;
  const classes = buttonClass({ variant, size, className });
  if (rest.as === "a") {
    const { as: _as, ...anchor } = rest;
    return <a {...anchor} className={classes} />;
  }
  const { as: _as, ...button } = rest as { as?: "button" } & React.ButtonHTMLAttributes<HTMLButtonElement>;
  return <button {...button} className={classes} />;
}

// ---------- Formulários ----------
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-tinta", className)}>{children}</label>
  );
}

const controlClass =
  "min-h-12 w-full rounded-[14px] border-0 bg-carta px-3 text-base text-tinta " +
  "placeholder:text-tinta-3 focus:outline-none focus:ring-2 focus:ring-tinta " +
  "disabled:bg-carta disabled:text-tinta-3";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, "h-12", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, "h-12", props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, "py-3", props.className)} />;
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-tinta">{label}</span>
      {children}
    </label>
  );
}

// ---------- Badge ----------
// Os nomes novos são semânticos; os antigos (green/red/amber/zinc/teal/blue) ficam
// como ALIAS para não haver um varrimento de call sites no meio da transição.
export type BadgeTone =
  | "confirmado"
  | "perda"
  | "atencao"
  | "neutro"
  | "acao"
  | "futuro"
  | "green"
  | "red"
  | "amber"
  | "zinc"
  | "teal"
  | "blue";

const BADGE_TONES: Record<BadgeTone, string> = {
  confirmado: "bg-carta text-tinta",
  perda: "bg-perda-tenue text-perda",
  atencao: "bg-perda-tenue text-perda",
  neutro: "bg-carta text-tinta",
  acao: "bg-carta text-tinta",
  futuro: "bg-futuro-tenue text-futuro",
  // aliases da V1
  green: "bg-carta text-tinta",
  red: "bg-perda-tenue text-perda",
  amber: "bg-perda-tenue text-perda",
  zinc: "bg-carta text-tinta",
  teal: "bg-carta text-tinta",
  blue: "bg-futuro-tenue text-futuro",
};

export function Badge({
  tone = "neutro",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------- Tabela ----------
// `edgeFade` mantém a assinatura; o indício de scroll usa a barra nativa, sem gradientes.
const edgeFadeStyle: CSSProperties = {
  scrollbarWidth: "thin",
  scrollbarColor: "var(--s-tinta-3) var(--s-carta)",
};

export function Table({
  children,
  className,
  edgeFade,
}: {
  children: ReactNode;
  className?: string;
  edgeFade?: boolean;
}) {
  return (
    <div className={cn("overflow-x-auto", className)} style={edgeFade ? edgeFadeStyle : undefined}>
      <table className="w-full min-w-max border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-regua px-3 py-2 text-left text-xs font-semibold text-tinta-3",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("border-b border-regua px-3 py-2.5 text-tinta-2", className)}>
      {children}
    </td>
  );
}

// ---------- KPI ----------
/** @deprecated A V2 não tem grelhas de KPI: um número sem decisão associada não
 *  aparece (PLANO.md §2, princípio 1). Fica enquanto as páginas da V1 existirem. */
export function StatCard({
  label,
  value,
  sub,
  tone = "zinc",
  icon: Icon,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "zinc" | "green" | "red" | "teal" | "amber";
  icon?: LucideIcon;
}) {
  // "green" já não é verde: é tinta cheia. Ver a nota do Badge.
  const tones = {
    zinc: "text-tinta",
    green: "text-tinta",
    red: "text-perda",
    teal: "text-tinta",
    amber: "text-perda",
  };
  const iconTones = {
    zinc: "bg-carta text-tinta",
    green: "bg-carta text-tinta",
    red: "bg-perda-tenue text-perda",
    teal: "bg-carta text-tinta",
    amber: "bg-perda-tenue text-perda",
  };
  return (
    <div className="h-full rounded-[20px] bg-carta p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-tinta-2">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]",
              iconTones[tone],
            )}
          >
            <Icon size={16} strokeWidth={1.75} />
          </span>
        )}
      </div>
      <p className={cn("mt-2.5 font-display text-4xl font-bold leading-none tracking-tight tabular-nums", tones[tone])}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs text-tinta-2">{sub}</p>}
    </div>
  );
}

// ---------- Vazio ----------
export function EmptyState({
  icon: Icon,
  action,
  className,
  children,
}: {
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "vazio flex flex-col items-center gap-3 rounded-[20px] bg-carta px-4 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-carta text-tinta-3">
          <Icon size={20} strokeWidth={1.75} />
        </span>
      )}
      <p className="max-w-sm text-[15px] font-medium text-tinta">{children}</p>
      {action}
    </div>
  );
}
