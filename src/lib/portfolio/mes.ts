// O MÊS EM CURSO (V4, REDESENHO.md §3.4). Módulo PURO: a única fonte da manchete de Hoje.
//
// Substitui três números que não batiam certo ("a ganhar com as decisões", "por cobrar",
// "perda esperada") por UMA pergunta: quanto deste mês já entrou?
//
// Porque o mês corrente NÃO tem "em atraso": os recibos entram com a recolha automática dos
// dias 15 e último (CLAUDE.md, caminho a). No dia 9, uma renda paga no dia 8 ainda não está
// na base, e chamar-lhe atraso seria acusar um inquilino que pagou. O que falta do mês é
// "por receber"; o atraso a sério é o dos meses anteriores, que o arrears.ts mede.

import { isMonthSettled, toMonthKey } from "../arrears";
import type { Snapshot } from "./snapshot";
import { mesPorExtenso } from "../format";

export interface ContratoDoMes {
  /** Renda de referência (a que o contrato costuma pagar, líquida de retenção). */
  esperado: number;
  /** Recebido com referência a este mês. */
  pago: number;
  /** A fonte dos recibos está parada (o avô): o mês não se sabe, não se cobra. */
  porSaber: boolean;
}

export interface ResumoDoMes {
  mes: string;
  esperado: number;
  recebido: number;
  porReceber: number;
  /** Renda dos contratos de fontes paradas: fora do esperado, à parte. */
  porSaber: { valor: number; contratos: number };
  pagos: number;
  total: number;
  /** Atraso dos meses ANTERIORES (arrears.ts). */
  atraso: { valor: number; contratos: number };
  titulo: string;
  contexto: string;
}

/** Dias de recolha automática dos recibos (o último é o último dia do mês). */
const DIA_RECOLHA = 15;

export function resumoDoMes(input: {
  hoje: string; // YYYY-MM-DD
  contratos: ContratoDoMes[];
  atraso: { valor: number; contratos: number };
}): ResumoDoMes {
  const mes = `${input.hoje.slice(0, 7)}-01`;
  const dia = parseInt(input.hoje.slice(8, 10), 10);
  let esperado = 0;
  let recebido = 0;
  let porReceber = 0;
  let pagos = 0;
  let total = 0;
  const porSaber = { valor: 0, contratos: 0 };

  for (const c of input.contratos) {
    if (c.porSaber) {
      porSaber.valor += c.esperado;
      porSaber.contratos += 1;
      recebido += c.pago; // o que entrou entrou, mesmo de uma fonte parada
      continue;
    }
    total += 1;
    esperado += c.esperado;
    recebido += c.pago;
    if (isMonthSettled(c.pago, c.esperado)) pagos += 1;
    else porReceber += Math.max(0, c.esperado - c.pago);
  }

  const nome = mesPorExtenso(mes).replace(/^./, (l) => l.toUpperCase());
  const faltam = total - pagos;
  const titulo =
    faltam === 0
      ? `${nome} fechado: ${pagos} de ${total} rendas recebidas.`
      : `${faltam === 1 ? "Falta 1 renda" : `Faltam ${faltam} rendas`} de ${mesPorExtenso(mes)}.`;
  const contexto =
    faltam === 0
      ? "Tudo o que se esperava este mês já entrou."
      : dia < DIA_RECOLHA
        ? `Os recibos entram com a recolha do dia ${DIA_RECOLHA}: parte do que falta já pode estar pago.`
        : "A próxima recolha de recibos é no último dia do mês.";

  return {
    mes,
    esperado: arred(esperado),
    recebido: arred(recebido),
    porReceber: arred(porReceber),
    porSaber: { valor: arred(porSaber.valor), contratos: porSaber.contratos },
    pagos,
    total,
    atraso: input.atraso,
    titulo,
    contexto,
  };
}

const arred = (v: number) => Math.round(v * 100) / 100;

/** O resumo do mês a partir do snapshot: a ponte entre a camada de cálculo e a manchete. */
export function resumoDoSnapshot(snap: Snapshot): ResumoDoMes {
  const mes = `${snap.hoje.slice(0, 7)}-01`;
  const parados = new Set(snap.fontes.filter((f) => f.parada).map((f) => f.landlord.id));
  const pagoPorContrato = new Map<string, number>();
  for (const p of snap.pagamentosRecentes) {
    if (toMonthKey(p.ref_month) !== mes) continue;
    pagoPorContrato.set(p.contract_id, (pagoPorContrato.get(p.contract_id) ?? 0) + p.amount);
  }
  const contratos: ContratoDoMes[] = snap.correntes.flatMap((a) => {
    const c = a.activeContract;
    if (!c) return [];
    const fonte = snap.fonteDoContrato[c.id];
    return [
      {
        esperado: snap.expectedByContract[c.id] ?? c.rent,
        pago: pagoPorContrato.get(c.id) ?? 0,
        porSaber: !!fonte && parados.has(fonte),
      },
    ];
  });
  return resumoDoMes({
    hoje: snap.hoje,
    contratos,
    atraso: { valor: snap.arrears.summary.totalDebt, contratos: snap.arrears.summary.contractsInArrears },
  });
}
