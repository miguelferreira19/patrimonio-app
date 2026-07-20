"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  CalendarClock,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "./ui";
import type { Role } from "@/lib/types";

interface NavLeaf {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavLeaf[];
}

// Grupos do rail — estrutura pensada para crescer: um novo item de topo de
// nível (ex.: "Atrasos") entra na lista `items` do grupo "Gestão" sem tocar
// no resto da navegação.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Gestão",
    items: [
      { href: "/fracoes", label: "Frações", icon: Building2 },
      { href: "/pagamentos", label: "Pagamentos", icon: HandCoins },
      { href: "/atrasos", label: "Atrasos", icon: CalendarClock },
      { href: "/despesas", label: "Despesas", icon: ReceiptText },
    ],
  },
  {
    label: "Referência",
    items: [
      { href: "/mercado", label: "Mercado", icon: TrendingUp },
      { href: "/senhorios", label: "Senhorios", icon: Users },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  label: "Administração",
  items: [{ href: "/admin", label: "Admin", icon: Settings }],
};

export function AppNav({ role, email }: { role: Role; email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const groups = role === "admin" ? [...NAV_GROUPS, ADMIN_GROUP] : NAV_GROUPS;

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const brand = (
    <div className="flex items-center gap-2.5 px-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/15">
        <Image src="/logo.png" alt="" width={22} height={25} className="h-[22px] w-auto" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">Património</p>
        <p className="truncate text-[11px] text-zinc-500">Gestão familiar</p>
      </div>
    </div>
  );

  function groupList(onNavigate?: () => void) {
    return (
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              {group.label}
            </p>
            <nav className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                      active
                        ? "bg-white/[0.06] text-white"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100",
                    )}
                  >
                    {active && (
                      <span
                        className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-teal-400"
                        aria-hidden="true"
                      />
                    )}
                    <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    );
  }

  function footer() {
    return (
      <div className="border-t border-white/10 px-3 py-4">
        <p className="truncate px-2 text-xs text-zinc-500">{email}</p>
        <span
          className={cn(
            "mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
            role === "admin"
              ? "bg-teal-500/10 text-teal-300 ring-teal-400/20"
              : "bg-white/5 text-zinc-400 ring-white/10",
          )}
        >
          {role === "admin" ? "Administrador" : "Leitura"}
        </span>
        <button
          onClick={signOut}
          className="mt-3 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <LogOut size={18} strokeWidth={1.75} />
          Sair
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Rail desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-zinc-950 md:flex">
        <div className="flex-1 overflow-y-auto py-5">
          <div className="mb-6">{brand}</div>
          {groupList()}
        </div>
        {footer()}
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-900 bg-zinc-950 px-4 md:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/15">
            <Image src="/logo.png" alt="" width={18} height={20} className="h-[18px] w-auto" />
          </span>
          <span className="text-sm font-semibold text-white">Património</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-30 bg-zinc-950/50 md:hidden" onClick={() => setOpen(false)}>
          <div
            className="flex h-full w-72 max-w-[85vw] flex-col bg-zinc-950 pt-16"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 overflow-y-auto py-1">{groupList(() => setOpen(false))}</div>
            {footer()}
          </div>
        </div>
      )}
    </>
  );
}
