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
import { emAtrasoDaCarteira } from "./insights";
import type { Snapshot } from "./snapshot";

export interface ContratoDoMes {
  /** Id do contrato: serve só para a lista de quem falta (Cobranças). */
  id?: string;
  /** Renda de referência (a que o contrato costuma pagar, líquida de retenção). */
  esperado: number;
  /** Recebido com referência a este mês. */
  pago: number;
  /** A fonte dos recibos está parada (o avô): o mês não se sabe, não se cobra. */
  porSaber: boolean;
}

/** Os estados em que o dinheiro deste mês pode estar. DISJUNTOS e na mesma base (renda de
 *  referência, líquida de retenção): somam exatamente `Cascata.total`. */
export type BaldeChave = "recebido" | "por_receber" | "sem_informacao";

export interface Balde {
  chave: BaldeChave;
  valor: number;
  contratos: number;
}

/** A CASCATA (AUDITORIA_CLAREZA.md, ponto 3): onde está a renda deste mês.
 *
 *  Existia a informação toda e não existia a identidade. O Hoje mostrava 7 648 € esperados,
 *  as Cobranças 6 845 €/mês sem informação e os Imóveis 15 241 € contratados — três números
 *  em três páginas, que nunca apareciam juntos nem fechavam.
 *
 *  `total` é a SOMA dos baldes, não um valor vindo de outro lado: a identidade é verdadeira
 *  por construção e não pode divergir. As vagas ficam de fora de propósito — renda potencial
 *  não é dinheiro deste mês, e metê-la aqui era misturar o que é com o que podia ser. Vivem
 *  em Oportunidades. */
export interface Cascata {
  total: number;
  baldes: Balde[];
  /** Conferência com a renda ILÍQUIDA dos contratos ativos. Base diferente (a cascata é
   *  líquida de retenção): mostra-se como nota, NUNCA se soma aos baldes. */
  contratado: { iliquido: number; contratos: number };
}

export interface ResumoDoMes {
  mes: string;
  esperado: number;
  recebido: number;
  porReceber: number;
  /** Onde está a renda deste mês, em baldes que fecham. */
  cascata: Cascata;
  /** Os contratos que compõem `porReceber`, com quanto falta a cada um. */
  porReceberContratos: Array<{ id: string; valor: number }>;
  /** Renda dos contratos de fontes paradas: fora do esperado, à parte. */
  porSaber: { valor: number; contratos: number };
  pagos: number;
  total: number;
  /** Atraso dos meses ANTERIORES (arrears.ts). */
  atraso: { valor: number; contratos: number };
  /** A explicação do estado do mês. Vive nos DETALHES do cartão, nunca na manchete: um
   *  título narrado ("Faltam 9 rendas de outubro.") é a tal história por detrás do KPI de
   *  que o utilizador se queixa (AUDITORIA_CLAREZA.md, ponto 13). */
  contexto: string;
}

/** Dias de recolha automática dos recibos (o último é o último dia do mês). */
const DIA_RECOLHA = 15;

export function resumoDoMes(input: {
  hoje: string; // YYYY-MM-DD
  contratos: ContratoDoMes[];
  atraso: { valor: number; contratos: number };
  /** Renda ilíquida dos contratos ativos, só para a nota de conferência da cascata. */
  contratadoIliquido?: { valor: number; contratos: number };
}): ResumoDoMes {
  const mes = `${input.hoje.slice(0, 7)}-01`;
  const dia = parseInt(input.hoje.slice(8, 10), 10);
  let esperado = 0;
  let recebido = 0;
  let porReceber = 0;
  let pagos = 0;
  let total = 0;
  const porSaber = { valor: 0, contratos: 0 };
  const porReceberContratos: ResumoDoMes["porReceberContratos"] = [];

  // Os baldes da cascata, contados no MESMO ciclo para não poderem divergir do resto.
  // `semInformacao` é o que falta à fonte parada, líquido do que ela ainda assim pagou —
  // senão esse dinheiro era contado duas vezes (uma em `recebido`, outra aqui).
  let semInformacao = 0;
  let semInformacaoContratos = 0;
  let porReceberContagem = 0;

  for (const c of input.contratos) {
    if (c.porSaber) {
      porSaber.valor += c.esperado;
      porSaber.contratos += 1;
      recebido += c.pago; // o que entrou entrou, mesmo de uma fonte parada
      const desconhecido = Math.max(0, c.esperado - c.pago);
      if (desconhecido > 0) {
        semInformacao += desconhecido;
        semInformacaoContratos += 1;
      }
      continue;
    }
    total += 1;
    esperado += c.esperado;
    recebido += c.pago;
    if (isMonthSettled(c.pago, c.esperado)) {
      pagos += 1;
    } else {
      const falta = Math.max(0, c.esperado - c.pago);
      porReceber += falta;
      if (falta > 0) porReceberContagem += 1;
      if (c.id) porReceberContratos.push({ id: c.id, valor: arred(falta) });
    }
  }

  const faltam = total - pagos;
  // Antes da recolha do dia 15 o mês ainda está a começar: dizer "faltam 9 rendas" a dia 13
  // alarmava por rendas já pagas cujo recibo só entra na recolha (PLANO_CLAREZA.md 5.6).
  const contexto =
    faltam === 0
      ? "Tudo o que se esperava este mês já entrou."
      : dia < DIA_RECOLHA
        ? `Os recibos entram com a recolha do dia ${DIA_RECOLHA}: parte do que falta já pode estar pago.`
        : "A próxima recolha de recibos é no último dia do mês.";

  const baldes: Balde[] = [
    { chave: "recebido", valor: arred(recebido), contratos: pagos },
    { chave: "por_receber", valor: arred(porReceber), contratos: porReceberContagem },
    { chave: "sem_informacao", valor: arred(semInformacao), contratos: semInformacaoContratos },
  ];

  return {
    mes,
    esperado: arred(esperado),
    recebido: arred(recebido),
    porReceber: arred(porReceber),
    cascata: {
      // A soma dos baldes, e não um valor de outra origem: a identidade não pode falhar.
      total: arred(baldes.reduce((a, b) => a + b.valor, 0)),
      baldes,
      contratado: {
        iliquido: arred(input.contratadoIliquido?.valor ?? 0),
        contratos: input.contratadoIliquido?.contratos ?? 0,
      },
    },
    porReceberContratos: porReceberContratos.sort((a, b) => b.valor - a.valor),
    porSaber: { valor: arred(porSaber.valor), contratos: porSaber.contratos },
    pagos,
    total,
    atraso: input.atraso,
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
    // Sem recibos há mais de 12 meses (arrears `stale`): quase sempre cessou sem baixa. Já
    // não conta como dívida, e tem a sua tarefa ("Confirmar se o contrato cessou"); somá-lo
    // ao "por receber" pedia todos os meses uma renda que ninguém espera (lote 2e).
    if (!c || a.arrears?.stale) return [];
    const fonte = snap.fonteDoContrato[c.id];
    return [
      {
        id: c.id,
        esperado: snap.expectedByContract[c.id] ?? c.rent,
        pago: pagoPorContrato.get(c.id) ?? 0,
        porSaber: !!fonte && parados.has(fonte),
      },
    ];
  });
  const emAtraso = emAtrasoDaCarteira(snap);
  // A renda dos MESMOS contratos que compõem a cascata, mas ilíquida (`contracts.rent`).
  // Serve de conferência: a diferença para o total da cascata é a retenção na fonte.
  const ativos = snap.correntes.filter((a) => a.activeContract && !a.arrears?.stale);
  return resumoDoMes({
    hoje: snap.hoje,
    contratos,
    atraso: { valor: emAtraso.reduce((a, r) => a + r.debt, 0), contratos: emAtraso.length },
    contratadoIliquido: {
      valor: ativos.reduce((a, x) => a + (x.activeContract?.rent ?? 0), 0),
      contratos: ativos.length,
    },
  });
}
