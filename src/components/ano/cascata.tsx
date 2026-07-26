// A CASCATA (PLANO.md §10.6): rendas → despesas → líquido → imposto → o que sobra.
//
// Uma linha por degrau, com a barra à escala do primeiro valor. Sem Recharts: são divs
// com largura em percentagem, e num documento anual que se imprime isso é uma vantagem —
// um SVG de biblioteca não sobrevive bem ao `print`.
//
// Sem hooks, logo sem "use client".

import { Money } from "@/components/kit";
import { cn } from "@/lib/cn";

export interface Degrau {
  label: string;
  valor: number;
  /** `entrada` soma, `saida` subtrai, `saldo` é um subtotal (barra a cheio, régua acima). */
  tipo: "entrada" | "saida" | "saldo";
  nota?: string;
}

const BARRA: Record<Degrau["tipo"], string> = {
  entrada: "bg-tinta/80",
  saida: "bg-perda/60",
  saldo: "bg-tinta",
};

export function Cascata({ degraus, className }: { degraus: Degrau[]; className?: string }) {
  const escala = Math.max(...degraus.map((d) => Math.abs(d.valor)), 1);

  return (
    <dl className={cn("space-y-2", className)}>
      {degraus.map((d) => (
        <div
          key={d.label}
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4",
            d.tipo === "saldo" && "border-t border-regua-forte pt-2",
          )}
        >
          <dt className="min-w-0">
            <span
              className={cn(
                "text-[13px]",
                d.tipo === "saldo" ? "font-medium text-tinta" : "text-tinta-2",
              )}
            >
              {d.tipo === "saida" ? "− " : ""}
              {d.label}
            </span>
            {d.nota && <p className="text-[11px] text-tinta-3">{d.nota}</p>}
          </dt>
          <dd>
            <Money
              value={Math.abs(d.valor)}
              escala={d.tipo === "saldo" ? "lg" : "sm"}
              tom={d.tipo === "saida" ? "perda" : "tinta"}
            />
          </dd>
          <div className="col-span-2 mt-1 h-1 overflow-hidden rounded-full bg-elevado">
            <div
              aria-hidden="true"
              className={cn("h-full", BARRA[d.tipo])}
              style={{ width: `${(Math.abs(d.valor) / escala) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}
