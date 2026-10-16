"use client";

// O INVÓLUCRO (V4, REDESENHO.md §3.2; destinos do PLANO_CLAREZA.md §4).
//
// Computador: barra lateral fina com os 5 destinos e a conta no rodapé.
// Telemóvel: cabeçalho fino e os MESMOS 5 destinos numa barra EM BAIXO, ao alcance do polegar.
//
// Os destinos respondem a perguntas: Hoje, Cobranças, Imóveis, Rentabilidade, Impostos. As
// rotas antigas continuam a acender o destino certo (`dono`).

import { Marca as MarcaIdentidade } from "./marca";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronUp,
  FolderOpen,
  LogOut,
  Settings,
  Stethoscope,
  Users,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { DESTINOS, type Destino } from "./destinos";
import { cn } from "./ui";
import { Pesquisa } from "./pesquisa";
import { Ajuda } from "./ajuda";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

const MOBILE = DESTINOS;

const ADMIN: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/tarefas", label: "Tarefas", icon: ClipboardList },
  { href: "/senhorios", label: "Senhorios", icon: Users },
  { href: "/arquivo", label: "Documentos", icon: FolderOpen },
  { href: "/saude", label: "Saúde dos dados", icon: Stethoscope },
  { href: "/admin", label: "Admin", icon: Settings },
];

function ativo(pathname: string, d: Destino): boolean {
  const meu = d.dono.some((p) => pathname === p || pathname.startsWith(p + "/"));
  return d.href === "/" ? pathname === "/" || meu : meu;
}

export function Shell({
  role,
  email,
  children,
}: {
  role: Role;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-papel md:flex">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-carta focus:px-3 focus:py-2 focus:text-sm focus:text-tinta focus:ring-2 focus:ring-acao"
      >
        Saltar para o conteúdo
      </a>

      {/* ---------- Computador: barra lateral ---------- */}
      <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-regua bg-carta px-3.5 py-5 md:flex">
        <Marca />
        <div className="mt-5">
          <Pesquisa />
        </div>
        <nav aria-label="Navegação principal" className="mt-4 flex flex-col gap-0.5">
          {DESTINOS.map((d) => {
            const on = ativo(pathname, d);
            return (
              <Link
                key={d.href}
                href={d.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm font-medium transition-colors duration-150",
                  on ? "bg-acao-tenue text-tinta" : "text-tinta-2 hover:bg-vellum hover:text-tinta",
                )}
              >
                <d.icon size={18} strokeWidth={1.8} className={on ? "text-acao" : undefined} aria-hidden="true" />
                {d.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 pt-6">
          {role === "admin" && <Link href="/saude" aria-current={pathname === "/saude" ? "page" : undefined} className="flex min-h-11 items-center gap-2.5 rounded-[10px] px-2.5 text-sm text-tinta-2 hover:bg-vellum"><Stethoscope size={18} aria-hidden="true" />Verificar dados</Link>}
          <div className="px-2.5"><Ajuda admin={role === "admin"} /></div>
          <Conta role={role} email={email} pathname={pathname} lado="cima" />
        </div>
      </aside>

      {/* ---------- Telemóvel: cabeçalho fino ---------- */}
      <header data-print="none" className="sticky top-0 z-40 flex items-center justify-between border-b border-regua bg-papel/90 px-4 py-2.5 backdrop-blur-md md:hidden">
        <Marca />
        <div className="flex items-center gap-2">
          <Ajuda admin={role === "admin"} />
          <Pesquisa compacta />
          <Conta role={role} email={email} pathname={pathname} lado="baixo" compacta />
        </div>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-[1280px] px-4 pb-28 pt-5 md:px-10 md:pb-16 md:pt-9"
      >
        <div key={pathname} className="animate-page-in">{children}</div>
      </main>

      {/* ---------- Telemóvel: separadores em baixo ---------- */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-regua bg-carta/95 pb-[max(env(safe-area-inset-bottom),10px)] pt-1.5 backdrop-blur-md md:hidden"
      >
        {MOBILE.map((d) => {
          const on = ativo(pathname, d);
          return (
            <Link
              key={d.href}
              href={d.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition-colors duration-150",
                on ? "text-tinta" : "text-tinta-3",
              )}
            >
              <d.icon size={22} strokeWidth={1.8} className={on ? "text-acao" : undefined} aria-hidden="true" />
              {d.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Marca() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1.5">
      <MarcaIdentidade />
    </Link>
  );
}

/** A conta: e-mail, ferramentas de admin e Sair. Um só menu, que abre para cima na barra
 *  lateral e para baixo no cabeçalho do telemóvel. Esc e clique fora fecham. */
function Conta({
  role,
  email,
  pathname,
  lado,
  compacta,
}: {
  role: Role;
  email: string | null;
  pathname: string;
  lado: "cima" | "baixo";
  compacta?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [aberto]);

  useEffect(() => setAberto(false), [pathname]);

  async function sair() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const inicial = (email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label={role === "admin" ? "Conta e administração" : "A minha conta"}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[10px] text-left text-sm text-tinta-2 transition-colors duration-150 hover:bg-vellum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao",
          compacta ? "size-11 justify-center p-1" : "px-2.5 py-2",
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-vellum text-xs font-semibold text-tinta">
          {inicial}
        </span>
        {!compacta && (
          <>
            <span className="min-w-0 flex-1 truncate">{role === "admin" ? "Administração" : "A minha conta"}</span>
            <ChevronUp size={14} className={cn("transition-transform duration-150", !aberto && "rotate-180")} />
          </>
        )}
      </button>
      {aberto && (
        <div
          aria-label="Opções da conta"
          className={cn(
            "absolute z-50 w-60 overflow-hidden rounded-xl border border-regua bg-elevado shadow-[0_16px_40px_-12px_rgba(15,21,23,0.28)] animate-menu",
            lado === "cima" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
          )}
        >
          <p className="truncate border-b border-regua px-3 py-2 text-xs text-tinta-3">{email}</p>
          {role === "admin" &&
            ADMIN.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-tinta-2 transition-colors duration-100 hover:bg-vellum hover:text-tinta"
              >
                <Icon size={15} strokeWidth={1.75} className="shrink-0 opacity-70" />
                {label}
              </Link>
            ))}
          <button
            onClick={sair}
            className="flex w-full items-center gap-2.5 border-t border-regua px-3 py-2 text-[13px] text-tinta-2 transition-colors duration-100 hover:bg-perda-tenue hover:text-perda"
          >
            <LogOut size={15} strokeWidth={1.75} className="shrink-0 opacity-70" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
