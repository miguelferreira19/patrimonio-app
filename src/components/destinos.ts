// OS DESTINOS da navegação (PLANO_CLAREZA.md §4), num módulo só.
//
// Viviam dentro do shell.tsx, e a Ajuda tinha a sua própria lista escrita à mão. As duas
// divergiram: o menu dizia "Rentabilidade" e "Impostos" e a orientação rápida continuava a
// mandar o utilizador a "Dinheiro" e "Arquivo", destinos que já não existem
// (AUDITORIA_CLAREZA.md, ponto 14).
//
// Agora há UMA lista. A Ajuda mapeia sobre ela e a descrição é um `Record` indexado pelo
// href, por isso acrescentar ou tirar um destino sem escrever a descrição é erro de
// compilação, e não um texto errado que ninguém vê durante meses.

import { Building2, CircleDot, Landmark, ReceiptText, TrendingUp, type LucideIcon } from "lucide-react";

export const DESTINOS = [
  { href: "/", label: "Hoje", icon: CircleDot, dono: ["/tarefas", "/gestao"] },
  {
    href: "/cobrancas",
    label: "Cobranças",
    icon: ReceiptText,
    dono: ["/cobrancas", "/pagamentos", "/atrasos", "/inquilinos"],
  },
  {
    href: "/imoveis",
    label: "Imóveis",
    icon: Building2,
    dono: ["/imoveis", "/carteira", "/fracoes", "/contratos", "/carta", "/arquivo", "/documentos", "/vagas", "/manutencao"],
  },
  {
    href: "/rentabilidade",
    label: "Rentabilidade",
    icon: TrendingUp,
    dono: ["/rentabilidade", "/analise", "/mercado", "/despesas"],
  },
  {
    href: "/impostos",
    label: "Impostos",
    icon: Landmark,
    dono: ["/impostos", "/ano", "/irs", "/dinheiro", "/relatorios", "/senhorios"],
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: LucideIcon;
  /** Prefixos de rota que pertencem a este destino (as antigas incluídas). */
  dono: string[];
}>;

export type Destino = (typeof DESTINOS)[number];
/** Os hrefs dos destinos, como união literal: é isto que trava a divergência da Ajuda. */
export type DestinoHref = Destino["href"];
