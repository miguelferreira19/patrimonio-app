// Sem "use client": estas primitivas são partilhadas (server + client). Nenhuma usa
// hooks; o Modal só é renderizado por componentes client (forms, grelhas), onde os
// handlers são válidos. Marcar este ficheiro como client criaria uma fronteira de
// serialização e as páginas server deixariam de poder passar icon={LucideIcon}.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ArrowDown, ArrowUp, X, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------- Cabeçalho de página ----------
// Título + descrição + ações à direita, para ritmo uniforme entre páginas.
// `eyebrow` liga o modo "hero" do redesign: sobre-título a acento, h1 maior e resumo em
// linguagem natural. Sem eyebrow o cabeçalho fica como estava (páginas não redesenhadas).
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
  const hero = Boolean(eyebrow);
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
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-teal-700 dark:text-teal-400">
            {eyebrow}
          </p>
        )}
        <h1
          className={cn(
            "font-semibold tracking-tight text-zinc-900 dark:text-zinc-100",
            hero ? "mt-1.5 text-2xl leading-tight md:text-3xl" : "text-xl md:text-2xl",
          )}
        >
          {title}
        </h1>
        {description && (
          <p className={cn("mt-2 text-sm text-zinc-500 dark:text-zinc-400", hero && "max-w-[520px] text-pretty")}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
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
    <section
      className={cn(
        "rounded-[14px] border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div>
            {title && <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

// ---------- Botões ----------
type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  // primary/danger são superfícies opacas com contraste próprio — não precisam de par
  // escuro. outline/ghost partem de branco/zinc claro e precisam de par escuro explícito.
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-teal-800 text-white hover:bg-teal-900",
    outline:
      "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 " +
      "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
    ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizes = {
    sm: "h-8 px-2.5 text-xs",
    md: "h-9 px-3.5 text-sm",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition",
        "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900",
        "disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

// ---------- Formulários ----------
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300", className)}>
      {children}
    </label>
  );
}

const controlClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 " +
  "disabled:bg-zinc-50 disabled:text-zinc-400 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 " +
  "dark:disabled:bg-zinc-800/60 dark:disabled:text-zinc-500";

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
type BadgeTone = "green" | "red" | "amber" | "zinc" | "teal" | "blue";

export function Badge({
  tone = "zinc",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  const tones: Record<BadgeTone, string> = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-400/20",
    red: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-400/20",
    amber: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-400/20",
    zinc: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-400/20",
    teal: "bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-950/40 dark:text-teal-400 dark:ring-teal-400/20",
    blue: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-400/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------- Tabela ----------
// `edgeFade`: indício visual (CSS puro, sem listeners de scroll) de que a tabela
// continua para a direita — usado nas grelhas largas (Pagamentos) onde o scroll
// horizontal é aceitável. Duas camadas de fundo: uma sombra "presa" ao contentor
// (background-attachment: scroll) e uma cobertura "presa" ao fim do conteúdo
// (background-attachment: local) que a tapa assim que se chega ao fim. As cores vêm de
// variáveis CSS (--fade-surface/--fade-edge, ver globals.css) porque um style inline
// não segue classes `dark:` — têm de trocar de par com o tema pelo próprio browser.
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
    <div
      className={cn("overflow-x-auto", className)}
      style={edgeFade ? edgeFadeStyle : undefined}
    >
      <table className="w-full min-w-max border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-zinc-200 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400",
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
    <td
      colSpan={colSpan}
      className={cn("border-b border-zinc-100 px-3 py-2.5 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300", className)}
    >
      {children}
    </td>
  );
}

// ---------- KPI ----------
export function StatCard({
  label,
  value,
  sub,
  tone = "zinc",
  icon: Icon,
  delta,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "zinc" | "green" | "red" | "teal" | "amber";
  icon?: LucideIcon;
  delta?: { value: ReactNode; direction?: "up" | "down" };
}) {
  const tones = {
    zinc: "text-zinc-900 dark:text-zinc-100",
    green: "text-emerald-700 dark:text-emerald-400",
    red: "text-red-700 dark:text-red-400",
    teal: "text-teal-700 dark:text-teal-400",
    amber: "text-amber-700 dark:text-amber-400",
  };
  // A caixa do ícone acompanha o tom do valor — o cartão passa o estado antes de se ler
  // o número, sem que a cor seja o único portador do significado (o `sub` diz-no por extenso).
  const iconTones = {
    zinc: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  };
  return (
    <div className="h-full rounded-[14px] border border-zinc-200 bg-white p-4 shadow-xs transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(15,118,110,0.22)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-zinc-500 dark:text-zinc-400">{label}</p>
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
      <p className={cn("mt-2.5 text-[27px] font-semibold leading-none tracking-tight tabular-nums", tones[tone])}>
        {value}
      </p>
      {delta && (
        <p
          className={cn(
            "mt-1.5 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
            delta.direction === "down" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {delta.direction === "down" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
          {delta.value}
        </p>
      )}
      {sub && <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </div>
  );
}

// ---------- Modal ----------
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
  if (!open) return null;
  return (
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/40 p-4 backdrop-blur-[2px] sm:items-center dark:bg-black/60">
      <div
        className={cn(
          "animate-modal-in my-8 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
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
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/60",
        className,
      )}
    >
      {Icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
          <Icon size={20} strokeWidth={1.75} />
        </span>
      )}
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{children}</p>
      {action}
    </div>
  );
}
