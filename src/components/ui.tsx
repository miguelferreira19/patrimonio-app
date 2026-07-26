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
// Separação por hairline, não por sombra: a 43 linhas de densidade as sombras são
// ruído. Elevação fica reservada a overlays (Modal, ficha, comando) — PLANO.md §10.3.
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
    <section className={cn("rounded-xl border border-regua bg-carta", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-regua px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-medium text-tinta">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-tinta-2">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

// ---------- Botões ----------
export type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const VARIANTES: Record<ButtonVariant, string> = {
  // primary/danger são superfícies opacas com contraste próprio nos dois temas.
  primary: "bg-teal-800 text-white hover:bg-teal-900",
  outline: "border border-regua-forte bg-carta text-tinta hover:bg-vellum",
  ghost: "text-tinta-2 hover:bg-vellum hover:text-tinta",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const TAMANHOS: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
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
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition",
    "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2 focus-visible:ring-offset-papel",
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
  "w-full rounded-lg border border-regua-forte bg-carta px-3 text-sm text-tinta " +
  "placeholder:text-tinta-3 focus:border-acao focus:outline-none focus:ring-2 focus:ring-acao/20 " +
  "disabled:bg-vellum disabled:text-tinta-3";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, "h-9", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, "h-9", props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, "py-2", props.className)} />;
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ---------- Badge ----------
// Os nomes novos são semânticos; os antigos (green/red/amber/zinc/teal/blue) ficam
// como ALIAS para não haver um varrimento de call sites no meio da transição.
// Nota: `confirmado` NÃO é verde — é pergaminho com tinta cheia. Um estado
// confirmado distingue-se de um neutro pelo PESO DA TINTA, não pelo matiz
// (PLANO.md §10.1: "o que está feito é tinta").
type BadgeTone =
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
  confirmado: "bg-vellum text-tinta ring-regua-forte",
  perda: "bg-perda-tenue text-perda ring-perda/20",
  atencao: "bg-atencao-tenue text-atencao ring-atencao/20",
  neutro: "bg-vellum/60 text-tinta-2 ring-regua",
  acao: "bg-acao-tenue text-acao ring-acao/20",
  futuro: "bg-futuro-tenue text-futuro ring-futuro/20",
  // aliases da V1
  green: "bg-vellum text-tinta ring-regua-forte",
  red: "bg-perda-tenue text-perda ring-perda/20",
  amber: "bg-atencao-tenue text-atencao ring-atencao/20",
  zinc: "bg-vellum/60 text-tinta-2 ring-regua",
  teal: "bg-acao-tenue text-acao ring-acao/20",
  blue: "bg-futuro-tenue text-futuro ring-futuro/20",
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
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------- Tabela ----------
// `edgeFade`: indício visual (CSS puro, sem listeners de scroll) de que a tabela
// continua para a direita. Duas camadas: uma sombra "presa" ao contentor
// (background-attachment: scroll) e uma cobertura "presa" ao fim do conteúdo
// (local) que a tapa ao chegar ao fim. As cores vêm de variáveis CSS
// (--fade-surface/--fade-edge) porque um style inline não segue classes de tema.
const edgeFadeStyle: CSSProperties = {
  backgroundImage:
    "linear-gradient(to left, var(--fade-surface), var(--fade-surface) 24px, transparent 44px), " +
    "linear-gradient(to left, var(--fade-edge), transparent 24px)",
  backgroundRepeat: "no-repeat, no-repeat",
  backgroundPosition: "right top, right top",
  backgroundSize: "44px 100%, 24px 100%",
  backgroundAttachment: "local, scroll",
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
        "border-b border-regua px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-tinta-3",
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
    teal: "text-acao",
    amber: "text-atencao",
  };
  const iconTones = {
    zinc: "bg-vellum text-tinta-2",
    green: "bg-vellum text-tinta",
    red: "bg-perda-tenue text-perda",
    teal: "bg-acao-tenue text-acao",
    amber: "bg-atencao-tenue text-atencao",
  };
  return (
    <div className="h-full rounded-xl border border-regua bg-carta p-4 transition-colors duration-150 hover:border-regua-forte">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-tinta-3">{label}</p>
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
      <p className={cn("mt-2.5 text-[27px] font-medium leading-none tracking-tight tabular-nums", tones[tone])}>
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
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-regua-forte bg-vellum/40 px-4 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-vellum text-tinta-3">
          <Icon size={20} strokeWidth={1.75} />
        </span>
      )}
      <p className="max-w-sm text-sm text-tinta-2">{children}</p>
      {action}
    </div>
  );
}
