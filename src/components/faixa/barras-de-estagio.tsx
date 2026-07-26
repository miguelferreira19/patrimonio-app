// Barras de estágio (PLANO.md §10.6): € de perda esperada por estágio 1/2/3.
//
// Uma barra empilhada e três números. Não é um gráfico do Recharts de propósito — são
// três divs com larguras em percentagem, e por isso não entra no caminho crítico nem
// arrasta uma biblioteca para uma superfície que já é densa.
//
// Sem hooks, logo sem "use client".

import { Money } from "@/components/kit";
import { cn } from "@/lib/cn";
import { ESTAGIO_LABEL, type Estagio } from "@/lib/portfolio/risk";

const TOM: Record<Estagio, { barra: string; texto: string }> = {
  1: { barra: "bg-tinta-3", texto: "text-tinta-2" },
  2: { barra: "bg-atencao", texto: "text-atencao" },
  3: { barra: "bg-perda", texto: "text-perda" },
};

export function BarrasDeEstagio({
  porEstagio,
  className,
}: {
  porEstagio: Record<Estagio, number>;
  className?: string;
}) {
  const estagios: Estagio[] = [1, 2, 3];
  const total = estagios.reduce((a, e) => a + porEstagio[e], 0);
  if (total <= 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-elevado">
        {estagios.map((e) =>
          porEstagio[e] > 0 ? (
            <div
              key={e}
              className={TOM[e].barra}
              style={{ width: `${(porEstagio[e] / total) * 100}%` }}
              aria-hidden="true"
            />
          ) : null,
        )}
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
        {estagios.map((e) => (
          <div key={e} className="flex items-baseline gap-1.5">
            <dt className={cn("uppercase tracking-[0.06em]", TOM[e].texto)}>
              {e}. {ESTAGIO_LABEL[e]}
            </dt>
            <dd>
              <Money value={porEstagio[e]} escala="sm" tom="tinta-2" />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
