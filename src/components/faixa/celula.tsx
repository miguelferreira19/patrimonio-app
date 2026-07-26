// Sem "use client": este componente é renderizado tanto por páginas server (ficha da
// fração) como por componentes client (grelha de Pagamentos, Atrasos). Não usa hooks;
// o `onClick` chega como prop de quem é client. Mesma regra do ui.tsx.
//
// Isto é o embrião da FAIXA (PLANO.md §5): a célula de um mês onde a ALTURA DA BARRA é
// a fração da renda que entrou. Substitui as duas implementações independentes que a V1
// tinha (`MonthsGrid` em atrasos e `YearBlock` na ficha da fração), com o mesmo
// vocabulário de estados a sair de `lib/monthcell.ts`.
//
// Codificação (não é só cor — cada estado tem FORMA própria, para funcionar em
// impressão, em daltonismo e a olho corrido):
//   pago    superfície cheia (vellum) + rótulo em tinta plena     "está feito"
//   parcial barra ao nível recebido, em âmbar                     "entrou isto"
//   falta   célula VAZIA com soleira vermelha                     "há aqui um buraco"
//   fora    hachura neutra                                        "não havia contrato"
//   futuro  hachura ardósia                                       "a app não sabe"

import { cn } from "@/lib/cn";
import { fillFraction, monthCellTitle, MONTH_CELL_LABEL, type MonthCellData } from "@/lib/monthcell";
import { fmtEur, monthLabel } from "@/lib/format";

const SUPERFICIE: Record<MonthCellData["status"], string> = {
  pago: "bg-vellum",
  parcial: "bg-vellum/40",
  falta: "border border-perda/25 bg-transparent",
  fora: "tecido-vazio",
  futuro: "tecido-futuro",
};

const ROTULO: Record<MonthCellData["status"], string> = {
  pago: "font-medium text-tinta",
  parcial: "text-atencao",
  falta: "text-perda",
  fora: "text-tinta-3",
  futuro: "text-futuro",
};

export function Celula({
  cell,
  onClick,
  showDeficit = false,
  className,
}: {
  cell: MonthCellData;
  onClick?: () => void;
  /** Mostra quanto falta, dentro da célula. Usado na grelha de 24 meses dos Atrasos. */
  showDeficit?: boolean;
  className?: string;
}) {
  const fill = fillFraction(cell);
  const titulo = monthCellTitle(cell);
  const conteudo = (
    <>
      {/* A barra: `paid/expected` em altura. Piso de 3px para que um parcial de 4%
          não seja visualmente igual a zero (risco C5 do PLANO.md). */}
      {cell.status === "parcial" && fill > 0 && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 bg-atencao/30"
          style={{ height: `max(3px, ${(fill * 100).toFixed(1)}%)` }}
        />
      )}
      {cell.status === "falta" && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-perda" />
      )}
      <span className="relative z-10 font-mono text-[10px] leading-tight">
        {monthLabel(cell.month, false)}
      </span>
      {showDeficit && cell.status === "parcial" && (
        <span className="relative z-10 font-mono text-[10px] leading-tight tabular-nums">
          −{fmtEur(cell.expected - cell.paid, 0)}
        </span>
      )}
    </>
  );

  const classes = cn(
    "relative flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[3px]",
    SUPERFICIE[cell.status],
    ROTULO[cell.status],
    className,
  );

  if (!onClick) {
    return (
      <div className={classes} title={titulo}>
        {conteudo}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={`${monthLabel(cell.month)}: ${MONTH_CELL_LABEL[cell.status].toLowerCase()}`}
      className={cn(
        classes,
        "transition-colors hover:border-acao/40 hover:bg-acao-tenue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-1 focus-visible:ring-offset-carta",
      )}
    >
      {conteudo}
    </button>
  );
}

/** Legenda. Recebe só os estados que a grelha em causa mostra, para não explicar
 *  estados que não estão no ecrã. */
export function CelulaLegenda({
  estados,
  className,
}: {
  estados: Array<MonthCellData["status"]>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-tinta-2",
        className,
      )}
    >
      {estados.map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "h-3 w-4 shrink-0 rounded-[2px]",
              status === "pago" && "bg-vellum ring-1 ring-inset ring-regua-forte",
              status === "parcial" && "bg-vellum/40 ring-1 ring-inset ring-atencao/40",
              status === "falta" && "border-b-2 border-perda bg-transparent ring-1 ring-inset ring-perda/25",
              status === "fora" && "tecido-vazio ring-1 ring-inset ring-regua",
              status === "futuro" && "tecido-futuro ring-1 ring-inset ring-futuro/25",
            )}
          />
          {MONTH_CELL_LABEL[status]}
        </span>
      ))}
    </div>
  );
}
