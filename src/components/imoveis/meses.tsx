// Os quadrados de mês (V4 F4; legibilidade 06/11). Sem "use client".
//
// Mesmo vocabulário da faixa (lib/monthcell.ts). Pago é tinta CHEIA e falta é vermelho CHEIO
// com um traço branco no meio: o traço faz a falta ler-se sem depender da cor (daltonismo) e
// separa-a do "parcial", que é metade âmbar. Antes a falta era âmbar fino e, em quadrados de
// 14 px, ninguém distinguia quem não pagava (pedido do utilizador, 06/11).
//
// Dois tamanhos: `sm` nos cartões de Imóveis; `md` (24 px) nas tabelas de quem deve, onde
// cada quadrado tem o nome do mês por cima (`MesesCabecalho`) e é lido um a um.

import { cn } from "@/lib/cn";
import { monthLabel } from "@/lib/format";
import type { EstadoMes } from "@/lib/portfolio/imoveis";

const COR: Record<EstadoMes, string> = {
  pago: "bg-tinta",
  parcial: "bg-[linear-gradient(to_top,var(--color-atencao)_55%,var(--color-vellum)_55%)]",
  falta:
    "bg-perda bg-[linear-gradient(var(--color-carta),var(--color-carta))] bg-[length:55%_2px] bg-center bg-no-repeat",
  fora: "bg-vellum",
  // Hachura em ardósia CHEIA a 60%: a `tecido-futuro` da faixa (riscas em futuro-tenue)
  // quase desaparecia sobre o cartão branco, e "por importar" é o estado da fonte parada.
  futuro: "bg-[repeating-linear-gradient(-45deg,var(--color-futuro)_0_1.5px,transparent_1.5px_4px)] opacity-60",
  curso: "bg-[repeating-linear-gradient(-45deg,var(--color-regua-forte)_0_1.5px,transparent_1.5px_4px)] ring-1 ring-inset ring-regua-forte",
};

const NOME: Record<EstadoMes, string> = {
  pago: "pago",
  parcial: "pago em parte",
  falta: "em atraso",
  fora: "sem contrato",
  futuro: "sem informação",
  curso: "mês em curso",
};

/** `sm` 14 px (cartões de Imóveis), `md` 18 px (Hoje), `lg` 24 px (Cobranças). */
export type TamanhoMeses = "sm" | "md" | "lg";

const CELULA: Record<TamanhoMeses, { caixa: string; gap: string; largura: string }> = {
  sm: { caixa: "size-3.5 rounded-[4px]", gap: "gap-[3px]", largura: "w-3.5" },
  md: { caixa: "size-[18px] rounded-[5px]", gap: "gap-[3px]", largura: "w-[18px]" },
  lg: { caixa: "size-6 rounded-[7px]", gap: "gap-1", largura: "w-6" },
};

export function Meses({
  meses,
  tamanho = "sm",
  className,
}: {
  meses: EstadoMes[];
  tamanho?: TamanhoMeses;
  className?: string;
}) {
  const { caixa, gap } = CELULA[tamanho];
  return (
    <span
      className={cn("flex", gap, className)}
      role="img"
      aria-label={`Últimos meses: ${meses.map((m) => NOME[m]).join(", ")}`}
    >
      {meses.map((m, i) => (
        <i
          key={i}
          className={cn("celula-in block", caixa, COR[m])}
          style={{ "--c": i } as React.CSSProperties}
          title={NOME[m]}
        />
      ))}
    </span>
  );
}

/** O nome de cada mês, alinhado com as células de `Meses` do mesmo tamanho: "nov" em `lg`,
 *  só a inicial ("N") em `md`, onde não cabem três letras. Desenha-se uma vez por tabela. */
export function MesesCabecalho({
  meses,
  tamanho = "lg",
  className,
}: {
  meses: string[];
  tamanho?: TamanhoMeses;
  className?: string;
}) {
  const { gap, largura } = CELULA[tamanho];
  return (
    <span className={cn("flex", gap, className)} aria-hidden="true">
      {meses.map((m) => {
        const nome = monthLabel(m, false);
        return (
          <span
            key={m}
            className={cn("text-center text-[10px] font-medium normal-case leading-none tracking-normal text-tinta-3", largura)}
          >
            {tamanho === "lg" ? nome : nome.charAt(0).toUpperCase()}
          </span>
        );
      })}
    </span>
  );
}

/** Legenda dos quadrados, para o topo ou o fundo da vista. */
export function MesesLegenda({ itens = ["pago", "parcial", "falta", "futuro", "curso"] }: { itens?: EstadoMes[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-tinta-2">
      {itens.map((m) => (
        <li key={m} className="flex items-center gap-1.5">
          <i className={cn("block size-3.5 rounded-[4px]", COR[m])} />
          {NOME[m]}
        </li>
      ))}
    </ul>
  );
}
