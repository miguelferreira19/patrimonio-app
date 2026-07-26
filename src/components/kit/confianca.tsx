// Sem "use client" — ver money.tsx.
import { cn } from "@/lib/cn";

// O tipo vive em lib/types.ts: é proveniência de dados, não apresentação.
export type { Nivel } from "@/lib/types";
import type { Nivel } from "@/lib/types";

const ROTULO: Record<Nivel, string> = {
  medido: "medido",
  estimado: "estimado",
  assumido: "assumido",
};

const TOM: Record<Nivel, string> = {
  // medido é tinta: o que é real não precisa de cor (PLANO.md §10.1)
  medido: "text-tinta-3 decoration-regua-forte",
  estimado: "text-futuro decoration-futuro/40",
  assumido: "text-atencao decoration-atencao/40",
};

/** Selo de confiança de um número.
 *
 *  Existe porque a incerteza desta carteira é ESTRUTURAL, não um defeito: os
 *  pagamentos derivam de recibos, 15 fichas estão incompletas, um senhorio não está
 *  modelado. A V1 punha isto em rodapés de prosa que ninguém lê; aqui viaja com o
 *  número (PLANO.md §2, princípio 3).
 *
 *  `conta` é a conta feita, em texto: é o que impede o selo de ser decorativo.
 *  Nunca escrever um `conta` vago ("aproximado") — ou se mostra a aritmética, ou
 *  o selo não deve existir.
 */
export function Confianca({
  nivel,
  conta,
  className,
}: {
  nivel: Nivel;
  conta?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "cursor-help align-middle text-[10px] font-medium uppercase tracking-[0.04em] underline decoration-dotted decoration-1 underline-offset-2",
        TOM[nivel],
        className,
      )}
      title={conta ?? ROTULO[nivel]}
    >
      {ROTULO[nivel]}
    </span>
  );
}
