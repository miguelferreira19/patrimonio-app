// Projeção de cashflow de RECEITA a N meses (V3 F4, ver V3.md).
//
// Módulo PURO: sem I/O, sem React, sem `new Date()` escondido — o relógio (`hoje`) entra
// sempre por parâmetro.
//
// FILOSOFIA: o motor probabilístico já existe em risk.ts (`pPagar`, Beta-Binomial com
// shrinkage). Este ficheiro não inventa modelo nenhum — só aplica esse motor ao futuro:
// para cada contrato, mede quantos meses passados devia e quantos liquidou, tira daí um
// p̂(pagar) com o intervalo que o próprio risk.ts já calcula, e projeta `renda × p̂` mês a
// mês. Nada de Monte Carlo, nada de série temporal, nada de biblioteca nova.

import { addMonthsKey, monthKeyFromDate } from "../format";
import { contractActiveInMonth } from "../calc";
import { pPagar, priorDaCarteira, type PPagar, type PriorCarteira } from "./risk";
import type { Contract, Expense } from "../types";
import type { PaymentLight } from "./load";

/** Abaixo disto um "pagamento" é ruído de cêntimos, não um mês liquidado. Mesma ordem de
 *  grandeza do EPSILON_EUR de arrears.ts, mas definido aqui à parte: este módulo não usa a
 *  banda de tolerância à renda de referência (retenção, atualizações) — o que interessa
 *  para o p̂ é só "houve sinal de pagamento neste mês", não o valor exato da dívida. */
const EPSILON_EUR = 1;

/** Um "mês" é sempre a chave "YYYY-MM-01" (mesma convenção de format.ts). Normaliza
 *  qualquer data ISO ("YYYY-MM-DD" ou com hora) para essa forma. */
function mesDe(dataISO: string): string {
  return `${dataISO.slice(0, 7)}-01`;
}

/**
 * Fronteira de dados LOCAL a este módulo: o mês mais recente, até `mesHoje`, com algum
 * pagamento registado. É mais simples do que `dataHorizonMonth` de arrears.ts (sem
 * carência de dias, sem cair no calendário) porque aqui só serve para uma coisa: não
 * contar como "devido e não pago" um mês que ainda não foi importado — isso enviesaria o
 * p̂ para baixo sem motivo. Sem pagamento nenhum na carteira, devolve null e nenhum
 * contrato entra com histórico (cai no prior).
 */
function horizonteDeDados(payments: PaymentLight[], mesHoje: string): string | null {
  let max: string | null = null;
  for (const p of payments) {
    const mes = mesDe(p.ref_month);
    if (mes <= mesHoje && (max === null || mes > max)) max = mes;
  }
  return max;
}

/** `liquidados`/`devidos` de UM contrato, medidos do início do contrato até à fronteira de
 *  dados. Sem `start_date` ou com o contrato a começar depois da fronteira não há histórico
 *  para julgar — fica a zero e o p̂ cai inteiro no prior da carteira, que é o comportamento
 *  honesto (nunca se inventa um histórico que não existe). */
function historicoDoContrato(
  contract: Contract,
  somasPorMes: Map<string, number>,
  horizonte: string | null,
): { liquidados: number; devidos: number } {
  if (!horizonte || !contract.start_date) return { liquidados: 0, devidos: 0 };
  const inicio = mesDe(contract.start_date);
  if (inicio > horizonte) return { liquidados: 0, devidos: 0 };

  let devidos = 0;
  let liquidados = 0;
  let mes = inicio;
  // Tecto de segurança (nunca deve disparar: inicio <= horizonte já foi verificado acima,
  // e o loop avança um mês de cada vez) — evita um ciclo infinito se alguma data vier
  // corrompida da base.
  let guarda = 0;
  while (mes <= horizonte && guarda < 100000) {
    if (contractActiveInMonth(contract, mes)) {
      devidos += 1;
      const pago = somasPorMes.get(`${contract.id}|${mes}`) ?? 0;
      if (pago > EPSILON_EUR) liquidados += 1;
    }
    mes = addMonthsKey(mes, 1);
    guarda += 1;
  }
  return { liquidados, devidos };
}

function somasPorContratoEMes(payments: PaymentLight[]): Map<string, number> {
  const somas = new Map<string, number>();
  for (const p of payments) {
    const chave = `${p.contract_id}|${mesDe(p.ref_month)}`;
    somas.set(chave, (somas.get(chave) ?? 0) + p.amount);
  }
  return somas;
}

export interface MesProjetado {
  /** "YYYY-MM-01". */
  mes: string;
  /** Σ renda dos contratos ativos no mês (contractActiveInMonth), sem desconto nenhum. */
  contratado: number;
  /** Σ renda × p̂(pagar) de cada contrato ativo. */
  esperado: number;
  /** Σ renda × limite inferior do intervalo de credibilidade a 90% (risk.ts). */
  p10: number;
  /** Σ renda × limite superior do mesmo intervalo. */
  p90: number;
  /** Quantos contratos contribuíram para este mês. */
  contratosAtivos: number;
}

/**
 * Projeta a receita contratada e a esperada (ajustada por p̂) a `meses` meses a partir de
 * `hoje`.
 *
 * `contratado` é o número ingénuo (renda de quem está ativo, sem desconto); `esperado` é o
 * que o motor de risco diz que realmente deve entrar; `p10`/`p90` propagam o MESMO
 * intervalo que `pPagar` já devolve por contrato — não se inventa uma distribuição da soma
 * (a soma de intervalos de credibilidade não é um intervalo de credibilidade da soma, mas é
 * a única coisa honesta de mostrar sem introduzir Monte Carlo, que está fora do âmbito).
 */
export function projetar({
  contracts,
  payments,
  hoje,
  meses = 24,
}: {
  contracts: Contract[];
  payments: PaymentLight[];
  hoje: Date;
  meses?: number;
}): MesProjetado[] {
  const mesHoje = monthKeyFromDate(hoje);
  const horizonte = horizonteDeDados(payments, mesHoje);
  const somas = somasPorContratoEMes(payments);

  const historicos = new Map(
    contracts.map((c) => [c.id, historicoDoContrato(c, somas, horizonte)]),
  );
  const prior: PriorCarteira = priorDaCarteira(Array.from(historicos.values()));
  const pPorContrato = new Map<string, PPagar>(
    contracts.map((c) => {
      const h = historicos.get(c.id)!;
      return [c.id, pPagar(h.liquidados, h.devidos, prior)];
    }),
  );

  const out: MesProjetado[] = [];
  for (let i = 0; i < meses; i++) {
    const mes = addMonthsKey(mesHoje, i);
    let contratado = 0;
    let esperado = 0;
    let p10 = 0;
    let p90 = 0;
    let contratosAtivos = 0;
    for (const c of contracts) {
      if (!contractActiveInMonth(c, mes)) continue;
      const p = pPorContrato.get(c.id)!;
      contratado += c.rent;
      esperado += c.rent * p.p;
      p10 += c.rent * p.lo;
      p90 += c.rent * p.hi;
      contratosAtivos += 1;
    }
    out.push({ mes, contratado, esperado, p10, p90, contratosAtivos });
  }
  return out;
}

export interface CapacidadeDeInvestimento {
  /** Σ `esperado` da projeção inteira. */
  receita24m: number;
  /** Σ despesa mensal média (últimos 12 meses reais) × meses da projeção; null quando não
   *  há despesas conhecidas suficientes para confiar numa média. */
  despesas24m: number | null;
  /** `receita24m - despesas24m`; null quando `despesas24m` é null. */
  liquido24m: number | null;
  /** Se há despesa suficiente registada para a app falar de "líquido" com alguma confiança. */
  despesasConhecidas: boolean;
  /** Se alguma das despesas da janela é ESPELHADA de um comproprietário (V3.md, frente B).
   *  Entra na conta — é a melhor estimativa que há para um senhorio sem dados próprios —
   *  mas obriga o líquido a mostrar-se como "assumido", nunca como medido. */
  despesasEspelhadas: boolean;
}

/** Abaixo disto os últimos 12 meses de despesas contam como "não há despesas conhecidas".
 *  A tabela `expenses` está praticamente vazia (V3.md): nenhum import a povoa, é tudo
 *  manual. Exigir pelo menos 3 registos no ano evita que um lançamento avulso (ex.: um
 *  seguro inserido uma vez, por engano ou teste) finja ser uma média mensal credível. */
const DESPESAS_MIN_REGISTOS = 3;

/**
 * Capacidade de investimento: receita projetada menos despesa conhecida.
 *
 * HONESTIDADE OBRIGATÓRIA (V3.md): não se estima despesa nenhuma. Quando os últimos 12
 * meses não têm despesas suficientes registadas, `despesas24m` e `liquido24m` vêm a
 * `null` e `despesasConhecidas` fica `false` — a UI mostra a receita e diz que não sabe o
 * resto, em vez de inventar um "líquido" que é na prática a receita inteira.
 */
export function capacidadeDeInvestimento({
  projecao,
  expenses,
  hoje,
}: {
  projecao: MesProjetado[];
  expenses: Expense[];
  hoje: Date;
}): CapacidadeDeInvestimento {
  const receita24m = projecao.reduce((acc, m) => acc + m.esperado, 0);

  const mesHoje = monthKeyFromDate(hoje);
  const inicioJanela = addMonthsKey(mesHoje, -12);
  const ultimos12 = expenses.filter((e) => {
    const mes = mesDe(e.expense_date);
    return mes >= inicioJanela && mes < mesHoje;
  });

  const despesasConhecidas = ultimos12.length >= DESPESAS_MIN_REGISTOS;
  if (!despesasConhecidas) {
    return {
      receita24m, despesas24m: null, liquido24m: null,
      despesasConhecidas: false, despesasEspelhadas: false,
    };
  }

  const totalUltimos12 = ultimos12.reduce((acc, e) => acc + e.amount, 0);
  const mediaMensal = totalUltimos12 / 12;
  const despesas24m = mediaMensal * projecao.length;
  return {
    receita24m,
    despesas24m,
    liquido24m: receita24m - despesas24m,
    despesasConhecidas: true,
    despesasEspelhadas: ultimos12.some((e) => e.origem !== "registada"),
  };
}

export interface ResumoDaProjecao {
  total: number;
  totalP10: number;
  totalP90: number;
  mediaMensal: number;
  /** `contratado` do primeiro mês menos o do último — quanto da renda contratada expira
   *  dentro do horizonte sem re-arrendamento nenhum assumido. */
  quedaContratada: number;
}

export function resumoDaProjecao(projecao: MesProjetado[]): ResumoDaProjecao {
  if (projecao.length === 0) {
    return { total: 0, totalP10: 0, totalP90: 0, mediaMensal: 0, quedaContratada: 0 };
  }
  const total = projecao.reduce((acc, m) => acc + m.esperado, 0);
  const totalP10 = projecao.reduce((acc, m) => acc + m.p10, 0);
  const totalP90 = projecao.reduce((acc, m) => acc + m.p90, 0);
  const primeiro = projecao[0];
  const ultimo = projecao[projecao.length - 1];
  return {
    total,
    totalP10,
    totalP90,
    mediaMensal: total / projecao.length,
    quedaContratada: primeiro.contratado - ultimo.contratado,
  };
}
