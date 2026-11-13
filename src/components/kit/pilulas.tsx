import Link from "next/link";
import { cn } from "@/lib/cn";

export function Pilulas({ itens, ativo }: {
  itens: Array<{ id: string; rotulo: string; n?: number; href: string }>;
  ativo: string;
}) {
  return (
    <nav aria-label="Filtrar lista" className="sem-barra flex gap-2 overflow-x-auto py-1">
      {itens.map(({ id, rotulo, n, href }) => (
        <Link key={id} href={href} aria-current={id === ativo ? "page" : undefined}
          className={cn("inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold",
            id === ativo ? "bg-tinta text-papel" : "bg-carta text-tinta")}
        >
          {rotulo}{n != null && <span className="tabular-nums">{n}</span>}
        </Link>
      ))}
    </nav>
  );
}
