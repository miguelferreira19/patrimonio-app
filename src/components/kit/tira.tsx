import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { monthLabel } from "@/lib/format";
import { ESTADO_MES_LABEL, type EstadoMes } from "@/lib/monthcell";

const ESTILOS: Record<EstadoMes, string> = {
  pago: "bg-tinta",
  atraso: "bg-perda",
  por_receber: "border-2 border-tinta-3",
  sem_info: "border-2 border-dashed border-tinta-3",
  fora: "bg-transparent",
};

export function Tira({ meses, tamanho = "m", rotulos = false }: {
  meses: Array<{ chave: string; estado: EstadoMes }>;
  tamanho?: "s" | "m";
  rotulos?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-flow-col auto-cols-fr items-end gap-1">
      {meses.map(({ chave, estado }, i) => {
        const descricao = `${monthLabel(chave)}: ${ESTADO_MES_LABEL[estado]}`;
        return (
          <div key={chave} className="flex min-w-0 flex-col items-center gap-1">
            <span role="img" title={descricao} aria-label={descricao}
              style={{ "--c": i } as CSSProperties}
              className={cn("celula-in block w-full rounded-[6px]", tamanho === "m" ? "h-11" : "h-6", ESTILOS[estado])} />
            {rotulos && <span aria-hidden="true" className="text-xs font-semibold text-tinta-2">{monthLabel(chave, false).slice(0, 1).toUpperCase()}</span>}
          </div>
        );
      })}
    </div>
  );
}
