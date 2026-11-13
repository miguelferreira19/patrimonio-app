"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { buttonClass } from "./ui";

export function Registar({ isGestor }: { isGestor: boolean }) {
  const pathname = usePathname();
  const visivel = pathname === "/" || pathname === "/rendas" || pathname.startsWith("/inquilinos/");
  if (!isGestor || !visivel) return null;
  return (
    <Link href="/rendas?registar=1" data-print="none" className={buttonClass({
      className: "fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 gap-2 bg-tinta px-5 text-papel md:right-6 md:bottom-6",
    })}>
      <Plus size={22} aria-hidden="true" />
      Registar
    </Link>
  );
}
