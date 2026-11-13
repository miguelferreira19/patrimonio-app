import { Building2, House, MoreHorizontal, ReceiptText, TrendingUp, type LucideIcon } from "lucide-react";

export const DESTINOS = [
  { href: "/", label: "Início", icon: House, dono: [] },
  {
    href: "/rendas",
    label: "Rendas",
    icon: ReceiptText,
    dono: ["/inquilinos", "/pagamentos", "/atrasos"],
  },
  {
    href: "/imoveis",
    label: "Imóveis",
    icon: Building2,
    dono: ["/fracoes", "/contratos", "/carteira"],
  },
  {
    href: "/financas",
    label: "Finanças",
    icon: TrendingUp,
    dono: ["/impostos", "/ano", "/irs", "/dinheiro", "/relatorios", "/analise", "/mercado", "/despesas"],
  },
  {
    href: "/mais",
    label: "Mais",
    icon: MoreHorizontal,
    dono: ["/tarefas", "/arquivo", "/documentos", "/senhorios", "/saude", "/admin", "/controlo", "/cartas", "/carta", "/gestao", "/vagas", "/manutencao"],
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: LucideIcon;
  dono: readonly string[];
}>;

export type Destino = (typeof DESTINOS)[number];
export type DestinoHref = Destino["href"];

export function destinoAtivo(pathname: string, destino: Destino): boolean {
  if (destino.href === "/") return pathname === "/";
  return [destino.href, ...destino.dono].some(
    (prefixo) => pathname === prefixo || pathname.startsWith(prefixo + "/"),
  );
}
