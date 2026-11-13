"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronUp, LogOut } from "lucide-react";
import { Marca as MarcaIdentidade } from "./marca";
import { DESTINOS, destinoAtivo } from "./destinos";
import { buttonClass, cn } from "./ui";
import { Pesquisa } from "./pesquisa";
import { Ajuda } from "./ajuda";
import { Registar } from "./registar";
import { createClient } from "@/lib/supabase/client";
import { pode, ROTULO_PAPEL } from "@/lib/papeis";
import type { Role } from "@/lib/types";

type ContaProps = { role: Role; email: string | null; pathname: string };

export function Shell({ role, email, children }: {
  role: Role; email: string | null; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const conta = { role, email, pathname };
  return (
    <div className="min-h-screen bg-papel md:flex">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-carta focus:px-3 focus:py-3 focus:text-sm focus:text-tinta focus:ring-2 focus:ring-tinta">
        Saltar para o conteúdo
      </a>
      <BarraLateral {...conta} />
      <Cabecalho {...conta} />
      <main id="conteudo" tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-4xl px-4 pt-5 pb-[calc(10rem+env(safe-area-inset-bottom))] md:px-10 md:pt-9 md:pb-16">
        <div key={pathname} className="pagina">{children}</div>
      </main>
      <Navegacao pathname={pathname} movel />
      <Registar isGestor={pode(role, "registar_pagamento")} />
    </div>
  );
}

function Navegacao({ pathname, movel = false }: { pathname: string; movel?: boolean }) {
  return (
    <nav aria-label="Principal" data-print="none" className={movel
      ? "fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-regua bg-papel pb-[env(safe-area-inset-bottom)] md:hidden"
      : "mt-4 flex flex-col gap-1"}>
      {DESTINOS.map((destino) => {
        const ativo = destinoAtivo(pathname, destino);
        return (
          <Link key={destino.href} href={destino.href} aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tinta",
              movel ? "min-h-16 min-w-0 flex-col justify-center gap-1 px-1 py-2 text-[11px]"
                : "gap-2.5 rounded-xl px-3 py-3 text-sm",
              ativo ? "font-bold text-tinta" : "font-medium text-tinta-2",
              !movel && (ativo ? "bg-papel" : "hover:bg-papel"),
            )}>
            <destino.icon size={22} strokeWidth={ativo ? 2.1 : 1.8} aria-hidden="true" className="shrink-0" />
            <span>{destino.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function BarraLateral(conta: ContaProps) {
  return (
    <aside data-print="none" className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-regua bg-carta px-3.5 py-5 md:flex">
      <Marca />
      <div className="mt-5"><Pesquisa /></div>
      <Navegacao pathname={conta.pathname} />
      <div className="mt-auto space-y-3 pt-6">
        <div className="px-2.5"><Ajuda admin={pode(conta.role, "administrar")} /></div>
        <Conta {...conta} />
      </div>
    </aside>
  );
}

function Cabecalho(conta: ContaProps) {
  return (
    <header data-print="none" className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-regua bg-papel px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 md:hidden">
      <Marca />
      <div className="flex shrink-0 items-center gap-2">
        <Pesquisa compacta />
        <Conta {...conta} compacta />
      </div>
    </header>
  );
}

function Marca() {
  return (
    <Link href="/" className="flex min-h-11 min-w-0 items-center rounded-lg px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta">
      <MarcaIdentidade />
    </Link>
  );
}

function Conta({ role, email, pathname, compacta }: ContaProps & { compacta?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!aberto) return;
    const fechar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        setAberto(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    const fora = (evento: PointerEvent) => {
      if (ref.current && !ref.current.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener("keydown", fechar);
    document.addEventListener("pointerdown", fora);
    return () => {
      document.removeEventListener("keydown", fechar);
      document.removeEventListener("pointerdown", fora);
    };
  }, [aberto]);
  useEffect(() => setAberto(false), [pathname]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto} aria-controls={aberto ? id : undefined} aria-label="A minha conta"
        className={cn("flex min-h-11 w-full items-center gap-2.5 rounded-xl text-left text-sm text-tinta-2 hover:bg-papel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta",
          compacta ? "size-11 justify-center" : "px-2.5 py-2")}>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-papel text-xs font-semibold text-tinta">{(email ?? "?").slice(0, 1).toUpperCase()}</span>
        {!compacta && <><span className="min-w-0 flex-1 truncate">A minha conta</span><ChevronUp size={16} aria-hidden="true" /></>}
      </button>
      {aberto && <div id={id} aria-label="Opções da conta" className={cn(
        "absolute z-50 w-60 max-w-[calc(100vw-2rem)] space-y-2 rounded-xl border border-regua bg-elevado p-3 text-sm text-tinta",
        compacta ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2")}>
        <div className="break-all">{email}</div>
        <div className="text-xs text-tinta-2">{ROTULO_PAPEL[role]}</div>
        <Sair />
      </div>}
    </div>
  );
}

export function Sair() {
  const router = useRouter();
  const [aSair, setASair] = useState(false);
  const [erro, setErro] = useState(false);
  async function sair() {
    setASair(true);
    setErro(false);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.push("/login");
      router.refresh();
    } catch {
      setErro(true);
      setASair(false);
    }
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={sair} disabled={aSair} className={buttonClass({ variant: "outline", className: "w-full" })}>
        <LogOut size={18} aria-hidden="true" />{aSair ? "A sair…" : "Sair"}
      </button>
      {erro && <p role="alert" className="text-xs text-perda">Não foi possível sair. Tenta de novo.</p>}
    </div>
  );
}
