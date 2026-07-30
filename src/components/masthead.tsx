"use client";

// O MASTHEAD (V3, 2026-07-29). Substitui o rail escuro do `nav.tsx`.
//
// PORQUÊ. A app tinha duas personalidades a lutar uma com a outra: o conteúdo é papel
// quente com serifa e hairlines, e a navegação era um rail `zinc-950` de dashboard SaaS,
// com taxonomia por cima de três links. A primeira coisa que se via era a menos pensada.
// Aqui a navegação deixa de ser chrome de aplicação e passa a ser o CABEÇALHO DE UM LIVRO
// DE CONTAS: o nome em Newsreader, uma régua, e os destinos como separadores.
//
// PARA A FAMÍLIA. Quem abre isto duas vezes por ano não precisa de grupos nem de gaveta:
// precisa de portas largas, sempre visíveis, no mesmo sítio no telemóvel e no computador.
// Os destinos ficam numa fila que não colapsa em hambúrguer. A administração é um menu
// discreto à direita — quem é viewer nem sabe que existe.
//
// REVERSÍVEL: o `nav.tsx` continua intacto. Voltar atrás é trocar o import no
// `(app)/layout.tsx` e repor as margens do `<main>` (está lá o comentário).

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, type LucideIcon } from "lucide-react";
import { LineChart, Settings, Stethoscope, TrendingUp, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "./ui";
import type { Role } from "@/lib/types";

/** Os destinos de TODA a gente. Sem ícones de propósito: um separador de texto lê-se mais
 *  depressa do que um ícone que é preciso decifrar, e mantém a fila calma.
 *  O Mercado entrou aqui em 2026-07-29 (pedido do utilizador): com as áreas das cadernetas
 *  preenchidas e o bug B5 do território fechado, passou a ter números para mostrar. */
const DESTINOS = [
  { href: "/", label: "Agora" },
  { href: "/carteira", label: "Carteira" },
  { href: "/mercado", label: "Mercado" },
  { href: `/ano/${new Date().getFullYear()}`, label: "Ano" },
  // O arquivo (2026-07-30): a família LÊ os contratos e as cadernetas, só o admin arquiva.
  { href: "/documentos", label: "Documentos" },
];

const ADMIN: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/analise", label: "Análise", icon: TrendingUp },
  { href: "/senhorios", label: "Senhorios", icon: Users },
  { href: "/saude", label: "Saúde dos dados", icon: Stethoscope },
  { href: "/admin", label: "Admin", icon: Settings },
];

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function Masthead({ role, email }: { role: Role; email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Data só no cliente: renderizá-la no servidor dá hydration mismatch quando o pedido
  // atravessa a meia-noite, e é decoração — não vale um erro de consola.
  const [hoje, setHoje] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date();
    setHoje(`${MESES[d.getMonth()]} de ${d.getFullYear()}`);
  }, []);

  // Fechar o menu de administração com Esc e com clique fora: é um overlay, e um overlay
  // que só fecha no próprio botão é uma armadilha de teclado.
  useEffect(() => {
    if (!menuAberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuAberto(false);
    }
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuAberto]);

  useEffect(() => setMenuAberto(false), [pathname]);

  function ativo(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href.split("?")[0]);
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-regua bg-papel">
      <div className="mx-auto max-w-[1360px] px-4 md:px-9">
        {/* Cabeça: o nome do livro. Some no scroll — não é chrome, é capa. */}
        <div className="flex items-end justify-between gap-4 pb-3 pt-5 md:pt-7">
          <Link href="/" className="group flex items-baseline gap-3">
            <Image
              src="/logo.png"
              alt=""
              width={22}
              height={25}
              className="h-[26px] w-auto opacity-80 transition-opacity duration-150 group-hover:opacity-100"
            />
            <span className="font-serif text-[26px] leading-none tracking-[-0.01em] text-tinta md:text-[30px]">
              Património
            </span>
            <span className="hidden text-[11px] text-tinta-3 sm:inline">
              {hoje ? `Família · ${hoje}` : "Família"}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            {role === "admin" && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuAberto((v) => !v)}
                  aria-expanded={menuAberto}
                  aria-haspopup="menu"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-tinta-2 transition-colors duration-150 hover:bg-acao-tenue hover:text-acao focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao"
                >
                  Administração
                  <ChevronDown
                    size={14}
                    strokeWidth={2}
                    className={cn("transition-transform duration-150", menuAberto && "rotate-180")}
                  />
                </button>
                {menuAberto && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-1.5 w-56 origin-top-right overflow-hidden rounded-xl border border-regua bg-elevado shadow-[0_16px_40px_-12px_rgba(30,28,25,0.28)] animate-menu"
                  >
                    <div className="border-b border-regua px-3 py-2">
                      <p className="truncate text-[11px] text-tinta-3">{email}</p>
                    </div>
                    {ADMIN.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        role="menuitem"
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors duration-100",
                          ativo(href) ? "bg-acao-tenue text-acao" : "text-tinta-2 hover:bg-acao-tenue hover:text-acao",
                        )}
                      >
                        <Icon size={15} strokeWidth={1.75} className="shrink-0 opacity-70" />
                        {label}
                      </Link>
                    ))}
                    <button
                      onClick={sair}
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 border-t border-regua px-3 py-2 text-[13px] text-tinta-2 transition-colors duration-100 hover:bg-perda-tenue hover:text-perda"
                    >
                      <LogOut size={15} strokeWidth={1.75} className="shrink-0 opacity-70" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            )}
            {role !== "admin" && (
              <button
                onClick={sair}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-tinta-3 transition-colors duration-150 hover:bg-perda-tenue hover:text-perda focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao"
              >
                <LogOut size={15} strokeWidth={1.75} />
                Sair
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Os separadores. Ficam colados ao topo no scroll: no telemóvel são a única
          navegação, e uma navegação que desaparece obriga a voltar ao início da página. */}
      <div className="sticky top-0 z-40 border-t border-regua bg-papel/92 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-[1360px] gap-0.5 px-2 md:gap-1 md:px-8">
          {DESTINOS.map(({ href, label }) => {
            const on = ativo(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex-1 px-2 py-3 text-center text-[13.5px] font-medium transition-colors duration-150 md:flex-none md:px-4 md:text-sm",
                  on ? "text-tinta" : "text-tinta-3 hover:text-tinta-2",
                )}
              >
                {label}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-1.5 bottom-0 h-[2px] origin-center rounded-full bg-acao transition-transform duration-200 md:inset-x-2",
                    on ? "scale-x-100" : "scale-x-0",
                  )}
                  style={{ transitionTimingFunction: "var(--e-out)" }}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
