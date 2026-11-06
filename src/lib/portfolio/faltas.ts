// O que FALTOU em cada mês fechado, e a quem. Módulo PURO: sem I/O, sem React.
//
// Porque existe (pedido do utilizador, 06/11): o gráfico dos 12 meses mostrava "recebido"
// contra uma linha tracejada, e não dizia QUEM falhou. Agora cada mês diz quanto faltou e
// que contratos faltaram, a partir das MESMAS células da faixa (`monthcell.ts`) que desenham
// as tiras de cada inquilino: o gráfico e a tira nunca se contradizem.
//
// Só entram células conhecidas. `fora` (sem contrato) e `futuro` (fonte parada, mês por
// importar) não são dívida nem renda esperada; contá-las é a confusão que a V1 pagou caro.

import type { MonthCellStatus } from "../monthcell";
import type { Snapshot } from "./snapshot";

/** Do pior para o melhor: num mês em que um inquilino tem dois contratos, a tira dele mostra o pior. */
const GRAVIDADE: MonthCellStatus[] = ["falta", "parcial", "futuro", "pago", "fora"];

/** Junta as tiras dos contratos de UM inquilino numa só, mês a mês pelo pior estado.
 *  Todas as tiras têm o mesmo comprimento (a faixa da carteira); a mais curta manda. */
export function tiraDoInquilino(tiras: MonthCellStatus[][]): MonthCellStatus[] {
  if (tiras.length === 0) return [];
  const n = Math.min(...tiras.map((t) => t.length));
  return Array.from({ length: n }, (_, i) =>
    tiras.map((t) => t[t.length - n + i]).sort((a, b) => GRAVIDADE.indexOf(a) - GRAVIDADE.indexOf(b))[0],
  );
}

export interface FaltaDoMes {
  month: string;
  /** Σ renda de referência dos contratos com informação nesse mês. */
  esperado: number;
  /** Σ do que entrou (um mês "pago" conta a renda inteira: a tolerância é de `isMonthSettled`). */
  recebido: number;
  /** Σ do que ficou por pagar: mês inteiro em falta mais o défice dos parciais. */
  falta: number;
  /** Contratos com o mês em falta ou pago em parte. */
  contratos: Array<{ contractId: string; propertyId: string; nome: string; emParte: boolean }>;
}

/** Os últimos `n` meses fechados da faixa, do mais antigo para o mais recente. */
export function faltasPorMes(snap: Pick<Snapshot, "correntes" | "faixaMeses">, n = 12): FaltaDoMes[] {
  const meses = snap.faixaMeses.slice(-n);
  const porMes = new Map<string, FaltaDoMes>(
    meses.map((month) => [month, { month, esperado: 0, recebido: 0, falta: 0, contratos: [] }]),
  );

  for (const a of snap.correntes) {
    const contrato = a.activeContract;
    for (const cel of a.faixa) {
      const f = porMes.get(cel.month);
      if (!f || cel.status === "fora" || cel.status === "futuro") continue;
      f.esperado += cel.expected;
      if (cel.status === "pago") {
        f.recebido += cel.expected;
        continue;
      }
      const entrou = Math.min(cel.paid, cel.expected);
      f.recebido += entrou;
      f.falta += cel.expected - entrou;
      if (contrato) {
        f.contratos.push({
          contractId: contrato.id,
          propertyId: a.property.id,
          nome: contrato.tenant_name,
          emParte: cel.status === "parcial",
        });
      }
    }
  }

  return meses.map((m) => porMes.get(m)!);
}
