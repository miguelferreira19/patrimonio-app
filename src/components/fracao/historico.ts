import { addMonthsKey } from "@/lib/format";
import { lastDueMonthKey, referenceRent, toMonthKey } from "@/lib/arrears";
import { monthCellStatus, type MonthCellData } from "@/lib/monthcell";
import type { Contract } from "@/lib/types";
import type { PaymentLight } from "@/lib/portfolio/load";
import type { Ativo, Snapshot } from "@/lib/portfolio/snapshot";

export interface HistYearBlock {
  year: number;
  months: MonthCellData[];
  totalReceived: number;
  monthsMissing: number;
}
export interface ContractHistory { contract: Contract; years: HistYearBlock[] }

function anoDoContrato(contract: Contract, year: number, monthSums: Map<string, number>, expected: number, lastDue: string): HistYearBlock {
  const start = contract.start_date ? toMonthKey(contract.start_date) : null;
  const end = contract.end_date ? toMonthKey(contract.end_date) : null;
  const months = Array.from({ length: 12 }, (_, i): MonthCellData => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}-01`;
    const paid = monthSums.get(month) ?? 0;
    const activeInMonth = (!start || month >= start) && (!end || month <= end);
    return { month, paid, expected, status: monthCellStatus({ month, paid, expected, activeInMonth, horizon: lastDue }) };
  });
  return { year, months, totalReceived: months.reduce((s, m) => s + m.paid, 0), monthsMissing: months.filter((m) => m.status === "falta").length };
}

export function buildContractHistory(contract: Contract, payments: PaymentLight[], lastDue: string, currentYear: number): ContractHistory {
  const monthSums = new Map<string, number>();
  for (const p of payments) {
    const month = toMonthKey(p.ref_month);
    monthSums.set(month, (monthSums.get(month) ?? 0) + p.amount);
  }
  const expected = referenceRent(monthSums, contract.rent, lastDue);
  const startYear = contract.start_date ? Number(contract.start_date.slice(0, 4))
    : payments.length > 0 ? Math.min(...payments.map((p) => Number(p.ref_month.slice(0, 4)))) : currentYear;
  const years: HistYearBlock[] = [];
  for (let year = startYear; year <= currentYear; year++) years.push(anoDoContrato(contract, year, monthSums, expected, lastDue));
  return { contract, years };
}

export function historicoDaFracao(a: Ativo, snap: Snapshot, payments: PaymentLight[]) {
  const c = a.activeContract;
  const fonte = c && snap.fontes.find((f) => f.landlord.id === snap.fonteDoContrato[c.id]);
  const lastDueCarteira = snap.horizon ?? lastDueMonthKey(new Date(`${snap.hoje}T12:00:00`));
  const lastDue = fonte?.horizonte && fonte.horizonte < lastDueCarteira ? fonte.horizonte : lastDueCarteira;
  const histories = a.contracts.filter((c) => c.status === "ativo").map((c) => buildContractHistory(
    c, payments.filter((p) => p.contract_id === c.id), lastDue, Number(snap.hoje.slice(0, 4)),
  ));
  const window12Start = addMonthsKey(lastDue, -11);
  const missingOutside12 = histories.flatMap((h) => h.years).flatMap((y) => y.months)
    .filter((m) => m.status === "falta" && m.month < window12Start).length;
  const historiaAtiva = histories[0];
  const emFalta12 = historiaAtiva ? historiaAtiva.years.flatMap((y) => y.months)
    .filter((m) => m.status === "falta" && m.month >= window12Start).length : 0;
  return {
    histories, missingOutside12, historiaAtiva, emFalta12,
    cessadosOcultos: a.contracts.length - histories.length,
    ultimosAnos: historiaAtiva ? historiaAtiva.years.slice(-2).reverse() : [],
    referenceRent: c?.rent ?? a.contracts[0]?.rent ?? null,
  };
}
