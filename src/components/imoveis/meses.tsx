// Os quadrados de mês dos cartões de Imóveis (V4 F4). Sem "use client".
//
// Mesmo vocabulário da faixa (lib/monthcell.ts), com uma diferença de forma pedida pela
// auditoria (REDESENHO.md P1): pago é tinta CHEIA e falta é vermelho CHEIO. Na faixa, pago
// era um bloco claro e falta uma soleira, e os dois confundiam-se num relance.

import { cn } from "@/lib/cn";
import type { EstadoMes } from "@/lib/portfolio/imoveis";

const COR: Record<EstadoMes, string> = {
  pago: "bg-tinta",
  parcial: "bg-[linear-gradient(to_top,var(--color-atencao)_55%,var(--color-vellum)_55%)]",
  falta: "bg-perda",
  fora: "bg-vellum",
  // Hachura em ardósia CHEIA a 60%: a `tecido-futuro` da faixa (riscas em futuro-tenue)
  // quase desaparecia sobre o cartão branco, e "por importar" é o estado da fonte parada.
  futuro: "bg-[repeating-linear-gradient(-45deg,var(--color-futuro)_0_1.5px,transparent_1.5px_4px)] opacity-60",
  curso: "bg-[repeating-linear-gradient(-45deg,var(--color-regua-forte)_0_1.5px,transparent_1.5px_4px)] ring-1 ring-inset ring-regua-forte",
};

const NOME: Record<EstadoMes, string> = {
  pago: "pago",
  parcial: "parcial",
  falta: "em falta",
  fora: "sem contrato",
  futuro: "por importar",
  curso: "em curso",
};

export function Meses({ meses, className }: { meses: EstadoMes[]; className?: string }) {
  return (
    <span
      className={cn("flex gap-[3px]", className)}
      role="img"
      aria-label={`Últimos meses: ${meses.map((m) => NOME[m]).join(", ")}`}
    >
      {meses.map((m, i) => (
        <i key={i} className={cn("block size-3.5 rounded-[4px]", COR[m])} title={NOME[m]} />
      ))}
    </span>
  );
}

/** Legenda dos quadrados, para o topo da vista. */
export function MesesLegenda() {
  const itens: EstadoMes[] = ["pago", "parcial", "falta", "futuro", "curso"];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-tinta-2">
      {itens.map((m) => (
        <li key={m} className="flex items-center gap-1.5">
          <i className={cn("block size-3 rounded-[3px]", COR[m])} />
          {NOME[m]}
        </li>
      ))}
    </ul>
  );
}
