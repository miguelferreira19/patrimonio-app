// Vocabulário ÚNICO do estado de um mês de um contrato.
//
// Porque existe (bugs B2 e L2/L3 do PLANO.md): a V1 tinha TRÊS respostas diferentes
// para a mesma pergunta "este mês está pago?".
//   - `arrears.ts`            → renda de REFERÊNCIA, tolerância de 90%, fronteira de dados
//   - `payments-grid.tsx`     → `contract.rent` e "qualquer pagamento = pago"
//   - `fracoes/[id]/page.tsx` → uma terceira variante, com o seu próprio mapa de cores
// O resultado é que o mesmo mês podia estar VERMELHO em Pagamentos e VERDE em Atrasos.
// Aqui há um só tipo e uma só função; a tolerância continua a viver em `isMonthSettled`
// (arrears.ts), que é a fonte da metodologia — este módulo não a reimplementa.
//
// Módulo PURO: sem I/O, sem React. Testável no `*.check.ts`.

import { EPSILON_EUR, isMonthSettled } from "./arrears";
import { fmtEur, monthLabel } from "./format";

export type MonthCellStatus =
  /** recebeu ≥ 90% da renda de referência */
  | "pago"
  /** recebeu algo, mas abaixo do limiar */
  | "parcial"
  /** mês devido e nada recebido */
  | "falta"
  /** não havia contrato neste mês (antes do início, depois do fim, ou vazio) */
  | "fora"
  /** ALÉM DA FRONTEIRA DO CONHECIDO: o mês ainda não foi importado. A app não sabe,
   *  e não o pode chamar "falta" — foi exatamente essa confusão que gerou milhares de
   *  euros de dívida falsa na V1 (ver a trava `dataHorizonMonth` em arrears.ts). */
  | "futuro";

export interface MonthCellData {
  month: string;
  status: MonthCellStatus;
  /** Recebido no mês (0 quando falta). */
  paid: number;
  /** Renda de referência do contrato nesse mês — a base de comparação. */
  expected: number;
}

export const MONTH_CELL_LABEL: Record<MonthCellStatus, string> = {
  pago: "Pago",
  parcial: "Parcial",
  falta: "Em falta",
  fora: "Sem contrato",
  futuro: "Por importar",
};

/** Fração da renda que entrou, 0 a 1. É o que a célula desenha como ALTURA: a barra
 *  não é decoração, é o valor (PLANO.md §5). */
export function fillFraction(cell: MonthCellData): number {
  if (cell.status === "fora" || cell.status === "futuro") return 0;
  if (cell.status === "pago") return 1;
  if (cell.expected <= 0) return 0;
  return Math.max(0, Math.min(1, cell.paid / cell.expected));
}

export function monthCellTitle(cell: MonthCellData): string {
  const label = monthLabel(cell.month);
  switch (cell.status) {
    case "pago":
      return `${label}: pago (${fmtEur(cell.paid, 2)})`;
    case "parcial":
      return `${label}: parcial, recebido ${fmtEur(cell.paid, 2)} de ${fmtEur(cell.expected, 2)} (faltam ${fmtEur(cell.expected - cell.paid, 2)})`;
    case "falta":
      return `${label}: em falta (esperado ${fmtEur(cell.expected, 2)})`;
    case "fora":
      return `${label}: fora do período do contrato`;
    default:
      return `${label}: ainda não importado. A app não sabe se foi pago.`;
  }
}

/** Estado de um mês a partir dos dados crus.
 *
 *  `horizon` é o último mês com recibos na carteira (`dataHorizonMonth`). Tudo o que
 *  esteja depois dele é `futuro`, NUNCA `falta`: sem import, "não pagou" e "ainda não
 *  importei" são indistinguíveis, e chamar-lhe falta cobra dívida a quem está em dia.
 */
export function monthCellStatus({
  month,
  paid,
  expected,
  activeInMonth,
  horizon,
}: {
  month: string;
  paid: number;
  expected: number;
  activeInMonth: boolean;
  horizon: string | null;
}): MonthCellStatus {
  if (!activeInMonth) return "fora";
  if (horizon === null || month > horizon) return "futuro";
  if (isMonthSettled(paid, expected)) return "pago";
  // EPSILON_EUR (1 €) e não `> 0`: abaixo disso é ruído de cêntimos de um recibo
  // repartido, não um pagamento parcial. Mesmo limiar de arrears.ts.
  if (paid >= EPSILON_EUR) return "parcial";
  return "falta";
}
