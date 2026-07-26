// O SNAPSHOT: o estado da carteira, calculado UMA vez (PLANO.md §7.1).
//
// Função PURA sobre `RawData` + um relógio. Nenhum I/O, nenhum React, nada de
// `new Date()` escondido — é o que permite testá-la com relógio fixo e provar que o
// refactor não mudou nenhum número (ver snapshot.check.ts).
//
// REGRA: este módulo não reimplementa domínio. Tudo o que já existe é reusado:
// computeArrears (atrasos), referenceRent/dataHorizonMonth (fronteira), marketView
// (mercado), monthRoll, vacancyGaps, upcomingContractEnds, rentUpdateEligibility,
// missingFichaFields, monthCellStatus. Se aparecer aqui uma regra de negócio nova, está
// no ficheiro errado.

import {
  computeArrears,
  dataHorizonMonth,
  isMonthSettled,
  lastDueMonthKey,
  referenceRent,
  toMonthKey,
  type ArrearsRow,
  type ArrearsSummary,
} from "../arrears";
import {
  contractActiveInMonth,
  currentProperties,
  expensesInMonth,
  isCurrentProperty,
  marketView,
  missingFichaFields,
  monthRoll,
  rentUpdateEligibility,
  sum,
  upcomingContractEnds,
  vacancyGaps,
  type MarketView,
  type VacancyGap,
} from "../calc";
import { addMonthsKey, lastMonthsKeys, monthKeyFromDate } from "../format";
import { monthCellStatus, type MonthCellData } from "../monthcell";
import { acumuladoDoAno, type PontoAcumulado } from "./renda";
import { rendaObservada, type RendaObservada } from "../rent";
import {
  curvaDeCura,
  perdaDoContrato,
  priorDaCarteira,
  resumirRisco,
  type PerdaContrato,
  type RiscoCarteira,
} from "./risk";
import type { Contract, InsightState, Landlord, Payment, Property } from "../types";
import type { RawData } from "./load";

export interface AtivoTitular {
  landlord: Landlord;
  quota: number;
}

/** Uma fração e tudo o que a app sabe sobre ela. É a linha da Carteira (a faixa). */
export interface Ativo {
  property: Property;
  /** Todos os contratos da fração, do mais recente para o mais antigo. */
  contracts: Contract[];
  activeContract: Contract | null;
  titulares: AtivoTitular[];
  /** false para terrenos e imóveis vendidos: fora de TODAS as métricas correntes (P0-2c). */
  corrente: boolean;
  /** Campos da ficha em falta, por nome PT-PT. Vazio = ficha completa. */
  fichaEmFalta: string[];
  mercado: MarketView;
  /** Linha de atrasos do contrato ATIVO. null quando não há contrato ativo. */
  arrears: ArrearsRow | null;
  /** A faixa: uma célula por mês, com a altura = fração da renda que entrou. */
  faixa: MonthCellData[];
  vazios: VacancyGap[];
  /** Elegibilidade de atualização de renda do contrato ativo. */
  rendaAtualizavel: ReturnType<typeof rentUpdateEligibility> | null;
  /** Risco do contrato ativo: p̂ de pagar, estágio e perda esperada (Fase 4). */
  risco: PerdaContrato | null;
}

/** Um mês agregado da carteira.
 *
 *  ATENÇÃO — duas noções de "esperado", de propósito:
 *  `esperadoContratado` soma `contract.rent` (o que está no contrato hoje) e é o que o
 *  gráfico do dashboard da V1 usa. `esperadoReferencia` soma a renda de REFERÊNCIA (o que
 *  o contrato costuma receber, líquido de retenção) e é o que o gráfico dos Atrasos usa.
 *  A V1 tinha as duas noções em páginas diferentes sem o dizer, e por isso os dois
 *  gráficos nunca batiam certo. Aqui ficam ambas explícitas: a Fase 1 preserva o
 *  comportamento, e trocar o dashboard para a referência passa a ser uma linha. */
export interface MesAgregado {
  month: string;
  esperadoContratado: number;
  esperadoReferencia: number;
  recebido: number;
  despesas: number;
  liquido: number;
  /** recebido / esperadoContratado (a taxa da V1). 0 quando não há esperado. */
  taxa: number;
}

export interface Snapshot {
  hoje: string;
  /** Os 12 meses da janela do dashboard, por ordem cronológica. */
  meses: string[];
  cobertura: {
    /** Último mês com recibos importados. Depois disto a app NÃO afirma nada. */
    fronteira: string | null;
    senhoriosTotal: number;
    senhoriosModelados: number;
    fichasIncompletas: number;
    recibosOrfaos: number;
  };
  /** Risco da carteira: prior, curva de cura medida e perda esperada por contrato. */
  risco: RiscoCarteira;
  /** Decisões adiadas/dispensadas (S3). Passa em cru: quem filtra é `construirFila`. */
  insightState: InsightState[];
  ativos: Ativo[];
  /** Atalho: `ativos` sem terrenos nem vendidos. É o universo de TODA a métrica corrente. */
  correntes: Ativo[];
  arrears: { rows: ArrearsRow[]; summary: ArrearsSummary };
  /** Renda de referência por contrato (todos, não só os ativos). */
  expectedByContract: Record<string, number>;
  /** A renda que os RECIBOS dizem, por contrato (ilíquida, dos últimos 12 meses).
   *  Serve para conferir `contracts.rent` nas duas direções — a renda de referência não
   *  serve, porque está limitada a `min(rent, mediana)` e por isso é cega a uma renda
   *  registada abaixo do que se recebe. Ver lib/rent.ts. */
  rendaObservadaPorContrato: Record<string, RendaObservada>;
  horizon: string | null;
  /** false num snapshot leve (sem histórico de pagamentos): `arrears`, `faixa`, `fluxo` e
   *  `carteira` vêm vazios de propósito. Quem os lê precisa do snapshot completo. */
  historicoCarregado: boolean;
  fluxo: MesAgregado[];
  /** O ano civil acumulado, mês a mês, contra o mesmo ponto do ano anterior. Vive aqui
   *  porque o snapshot é o único sítio com o histórico COMPLETO de pagamentos: a janela
   *  de `fluxo` são 12 meses móveis, que respondem a outra pergunta ("como correu o último
   *  ano?") e nunca a "quanto já entrou este ano?". Vazio num snapshot leve. */
  acumulado: PontoAcumulado[];
  /** A faixa da CARTEIRA: o agregado mensal com o mesmo vocabulário das faixas de cada
   *  fração. Substitui o gráfico de fluxo — a substância já é o gráfico (PLANO.md §5). */
  carteira: MonthCellData[];
  /** Pagamentos da janela de `meses`, e só dela. O snapshot tem o histórico COMPLETO
   *  (~5.100 linhas) porque precisa dele para a renda de referência, mas as superfícies
   *  que passam pagamentos a componentes client só devem mandar este recorte — o resto
   *  seria payload RSC desperdiçado. */
  pagamentosRecentes: Payment[];
  recibosPorEmitir: Array<{ contract: Contract; property: Property | undefined }>;
  contratosATerminar: Array<{ contract: Contract; property: Property | undefined }>;
  ocupacao: { taxa: number; vagas: Property[]; perdaAtual: number };
  mercado: { potencialMes: number; abaixo: Ativo[] };
  totais: { rendaContratada: number; recebido12m: number; vptTotal: number };
}

export interface SnapshotOptions {
  /** Meses da faixa de cada fração. 24 é a janela dos Atrasos; a Carteira permitirá 60. */
  faixaMeses?: number;
  /** Meses do agregado de fluxo. 12 é a janela do dashboard. */
  fluxoMeses?: number;
  /** Horizonte, em dias, dos contratos a terminar. */
  fimDeContratoDias?: number;
}

export function buildSnapshot(raw: RawData, today: Date, options: SnapshotOptions = {}): Snapshot {
  const { faixaMeses = 24, fluxoMeses = 12, fimDeContratoDias = 90 } = options;

  const hoje = isoDate(today);
  const thisMonth = monthKeyFromDate(today);
  const meses = lastMonthsKeys(fluxoMeses, thisMonth);

  const propertiesById = new Map(raw.properties.map((p) => [p.id, p]));
  const landlordsById = new Map(raw.landlords.map((l) => [l.id, l]));

  // ---------- Fronteira do conhecido ----------
  // A MESMA trava dos atrasos: o último mês devido nunca passa o último mês importado.
  const horizon = dataHorizonMonth(raw.payments, today);
  const lastDue = horizon ?? lastDueMonthKey(today);

  // ---------- Somas por contrato-mês (uma passagem sobre os ~5.100 pagamentos) ----------
  const sumsByContract = new Map<string, Map<string, number>>();
  for (const p of raw.payments) {
    let sums = sumsByContract.get(p.contract_id);
    if (!sums) {
      sums = new Map<string, number>();
      sumsByContract.set(p.contract_id, sums);
    }
    const k = toMonthKey(p.ref_month);
    sums.set(k, (sums.get(k) ?? 0) + p.amount);
  }

  // Ilíquido por contrato-mês, a partir dos recibos: base para conferir contracts.rent.
  const recibosPorContrato = new Map<string, Map<string, number>>();
  for (const r of raw.receiptsRecentes) {
    if (!r.contract_id) continue;
    const mes = toMonthKey(r.ref_month);
    let m = recibosPorContrato.get(r.contract_id);
    if (!m) {
      m = new Map<string, number>();
      recibosPorContrato.set(r.contract_id, m);
    }
    m.set(mes, (m.get(mes) ?? 0) + r.amount);
  }
  const rendaObservadaPorContrato: Record<string, RendaObservada> = {};
  for (const c of raw.contracts) {
    const obs = rendaObservada(recibosPorContrato.get(c.id) ?? new Map());
    if (obs) rendaObservadaPorContrato[c.id] = obs;
  }

  const expectedByContract: Record<string, number> = {};
  for (const c of raw.contracts) {
    expectedByContract[c.id] = referenceRent(sumsByContract.get(c.id) ?? new Map(), c.rent, lastDue);
  }

  // ---------- P0-2c: terrenos e vendidos fora de tudo o que é corrente ----------
  const currentProps = currentProperties(raw.properties);
  const currentPropertyIds = new Set(currentProps.map((p) => p.id));
  const currentContracts = raw.contracts.filter((c) => currentPropertyIds.has(c.property_id));
  const activeContracts = currentContracts.filter((c) => c.status === "ativo");

  // ---------- Atrasos: fonte ÚNICA, a mesma da página de Atrasos ----------
  const arrearsResult = computeArrears(activeContracts, raw.payments, today);
  const arrearsByContract = new Map(arrearsResult.rows.map((r) => [r.contractId, r]));

  // ---------- Risco (Fase 4): PD, cura e perda esperada ----------
  //
  // DUAS janelas, de propósito:
  //
  //   - `liquidados`/`devidos` varrem o HISTÓRICO TODO. É isso que dá sentido ao
  //     shrinkage: um contrato de 2014 tem 140 meses a falar por si e um assinado em maio
  //     tem 2, e o posterior tem de os tratar de maneira diferente.
  //   - `faltas` (a base da PERDA) fica nos últimos 24 meses devidos, o MESMO cap que o
  //     `debt` do arrears.ts. Um mês em falta de 2016 não é dinheiro a cobrar, é história;
  //     incluí-lo fazia a perda esperada ultrapassar a dívida que ela veio substituir e as
  //     duas deixavam de ser comparáveis.
  //
  // O teto de ambas é `lastDue`, a mesma fronteira de tudo o resto: meses por importar não
  // são meses falhados.
  const inicioPerda = addMonthsKey(lastDue, -23);
  const observacaoPorContrato = new Map<
    string,
    { liquidados: number; devidos: number; faltas: Array<{ valor: number; idadeMeses: number }> }
  >();
  for (const c of activeContracts) {
    const sums = sumsByContract.get(c.id) ?? new Map<string, number>();
    const esperado = expectedByContract[c.id] ?? c.rent;
    const obs = { liquidados: 0, devidos: 0, faltas: [] as Array<{ valor: number; idadeMeses: number }> };
    const inicio = c.start_date ? toMonthKey(c.start_date) : null;
    if (inicio) {
      for (let m = inicio; m <= lastDue; m = addMonthsKey(m, 1)) {
        if (!contractActiveInMonth(c, m)) continue;
        obs.devidos += 1;
        const pago = sums.get(m) ?? 0;
        if (isMonthSettled(pago, esperado)) {
          obs.liquidados += 1;
        } else {
          if (m >= inicioPerda) {
            obs.faltas.push({
              valor: Math.max(0, esperado - pago),
              idadeMeses: mesesEntre(m, lastDue),
            });
          }
        }
      }
    }
    observacaoPorContrato.set(c.id, obs);
  }

  // A curva de cura sai dos atrasos REAIS de pagamento da carteira: quantos meses
  // passaram entre o mês de referência e o dia em que o dinheiro entrou.
  const atrasosEmMeses: number[] = [];
  for (const p of raw.payments) {
    if (!p.received_date) continue;
    const d = mesesEntre(toMonthKey(p.ref_month), toMonthKey(p.received_date));
    if (d >= 0) atrasosEmMeses.push(d);
  }
  const curva = curvaDeCura(atrasosEmMeses);
  const prior = priorDaCarteira(Array.from(observacaoPorContrato.values()));
  const riscoPorContrato = new Map<string, PerdaContrato>();
  for (const c of activeContracts) {
    const obs = observacaoPorContrato.get(c.id);
    const arr = arrearsByContract.get(c.id);
    if (!obs) continue;
    riscoPorContrato.set(
      c.id,
      perdaDoContrato({
        contractId: c.id,
        faltas: obs.faltas,
        liquidados: obs.liquidados,
        devidos: obs.devidos,
        streak: arr?.streak ?? 0,
        semHistorico: arr?.semHistorico ?? true,
        prior,
        curva,
      }),
    );
  }
  const risco = resumirRisco(Array.from(riscoPorContrato.values()), prior, curva);

  // ---------- Ativos (uma linha por fração) ----------
  const contractsByProperty = new Map<string, Contract[]>();
  for (const c of raw.contracts) {
    const list = contractsByProperty.get(c.property_id) ?? [];
    list.push(c);
    contractsByProperty.set(c.property_id, list);
  }
  const ownersByProperty = new Map<string, AtivoTitular[]>();
  for (const o of raw.owners) {
    const landlord = landlordsById.get(o.landlord_id);
    if (!landlord) continue;
    const list = ownersByProperty.get(o.property_id) ?? [];
    list.push({ landlord, quota: o.quota ?? 100 });
    ownersByProperty.set(o.property_id, list);
  }

  const faixaMesesKeys = lastMonthsKeys(faixaMeses, lastDue);

  const ativos: Ativo[] = raw.properties.map((property) => {
    const contracts = (contractsByProperty.get(property.id) ?? [])
      .slice()
      .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
    const activeContract = contracts.find((c) => c.status === "ativo") ?? null;
    const arrears = activeContract ? arrearsByContract.get(activeContract.id) ?? null : null;

    return {
      property,
      contracts,
      activeContract,
      titulares: ownersByProperty.get(property.id) ?? [],
      corrente: isCurrentProperty(property),
      fichaEmFalta: missingFichaFields(property),
      mercado: marketView(property, activeContract ?? undefined, raw.benchmarks),
      arrears,
      faixa: buildFaixa(
        activeContract,
        sumsByContract,
        expectedByContract,
        faixaMesesKeys,
        horizon,
      ),
      vazios: vacancyGaps(contracts, hoje).filter((g) => g.propertyId === property.id),
      risco: activeContract ? riscoPorContrato.get(activeContract.id) ?? null : null,
      rendaAtualizavel: activeContract
        ? rentUpdateEligibility(activeContract, raw.rentUpdates, raw.coefficients, hoje)
        : null,
    };
  });
  const correntes = ativos.filter((a) => a.corrente);

  // ---------- Fluxo mensal ----------
  const fluxo: MesAgregado[] = meses.map((m) => {
    const roll = monthRoll(m, currentContracts, raw.payments, propertiesById);
    const esperadoContratado = sum(roll.map((r) => r.expected));
    const recebido = sum(roll.map((r) => r.payment?.amount));
    const esperadoReferencia = sum(
      roll.map((r) => expectedByContract[r.contract.id] ?? r.contract.rent),
    );
    const despesas = sum(expensesInMonth(raw.expenses, m).map((e) => e.amount));
    return {
      month: m,
      esperadoContratado,
      esperadoReferencia,
      recebido,
      despesas,
      liquido: recebido - despesas,
      taxa: esperadoContratado > 0 ? recebido / esperadoContratado : 0,
    };
  });

  // ---------- A faixa da carteira ----------
  // Agregado: recebido vs esperado de referência dos contratos JÁ em vigor no mês. O
  // estado usa a mesma função das faixas individuais, por isso a fronteira aparece aqui
  // exatamente como aparece em cada linha.
  const carteira: MonthCellData[] = meses.map((m) => {
    const ativosNoMes = currentContracts.filter((c) => contractActiveInMonth(c, m));
    const expected = sum(ativosNoMes.map((c) => expectedByContract[c.id] ?? c.rent));
    const paid = sum(
      ativosNoMes.map((c) => sumsByContract.get(c.id)?.get(m) ?? 0),
    );
    return {
      month: m,
      paid,
      expected,
      status: monthCellStatus({
        month: m,
        paid,
        expected,
        activeInMonth: ativosNoMes.length > 0,
        horizon,
      }),
    };
  });

  // ---------- Recibos por emitir (checklist do mês) ----------
  const issued = new Set<string>();
  for (const r of raw.receiptsThisMonth) {
    if (r.contract_id) issued.add(r.contract_id);
    if (r.pf_contract_no) issued.add(r.pf_contract_no);
  }
  const recibosPorEmitir = activeContracts
    .filter((c) => {
      if (issued.has(c.id) || (c.pf_contract_no && issued.has(c.pf_contract_no))) return false;
      // Contratos de cadência própria (ex.: trimestral) só entram no mês em que voltam
      // a vencer — senão a checklist pedia recibos todos os meses a quem paga ao trimestre.
      const row = arrearsByContract.get(c.id);
      const cadence = row?.cadence ?? 1;
      if (cadence >= 2 && row?.lastPaidMonth) {
        return addMonthsKey(row.lastPaidMonth, cadence) <= thisMonth;
      }
      return true;
    })
    .map((c) => ({ contract: c, property: propertiesById.get(c.property_id) }))
    .sort((a, b) => (a.property?.name ?? "").localeCompare(b.property?.name ?? "", "pt"));

  // ---------- Ocupação e vazios em aberto ----------
  const occupiedIds = new Set(activeContracts.map((c) => c.property_id));
  const vagas = currentProps.filter((p) => !occupiedIds.has(p.id));
  const openGaps = vacancyGaps(currentContracts, hoje).filter((g) => g.gapEnd === null);

  // ---------- Mercado ----------
  const abaixo = correntes
    .filter((a) => a.mercado.deviation !== null && a.mercado.deviation < 0)
    .sort((a, b) => (a.mercado.deviation ?? 0) - (b.mercado.deviation ?? 0));

  return {
    hoje,
    meses,
    cobertura: {
      fronteira: horizon,
      senhoriosTotal: raw.landlords.length,
      senhoriosModelados: new Set(raw.owners.map((o) => o.landlord_id)).size,
      fichasIncompletas: correntes.filter((a) => a.fichaEmFalta.length > 0).length,
      recibosOrfaos: raw.orphanReceipts,
    },
    ativos,
    correntes,
    historicoCarregado: raw.historicoCarregado,
    arrears: { rows: arrearsResult.rows, summary: arrearsResult.summary },
    expectedByContract,
    risco,
    insightState: raw.insightState,
    rendaObservadaPorContrato,
    horizon,
    fluxo,
    // Só com histórico completo: num snapshot leve `raw.payments` vem vazio, e uma série
    // de zeros lia-se como "não entrou nada este ano" em vez de "não foi carregado".
    acumulado: raw.payments.length > 0 ? acumuladoDoAno(raw.payments, today) : [],
    carteira,
    pagamentosRecentes: raw.paymentsRecentes.filter((p) => toMonthKey(p.ref_month) >= meses[0]),
    recibosPorEmitir,
    contratosATerminar: upcomingContractEnds(activeContracts, hoje, fimDeContratoDias).map((c) => ({
      contract: c,
      property: propertiesById.get(c.property_id),
    })),
    ocupacao: {
      taxa: currentProps.length > 0 ? occupiedIds.size / currentProps.length : 0,
      vagas,
      perdaAtual: sum(openGaps.map((g) => g.lostRent)),
    },
    mercado: {
      potencialMes: sum(correntes.map((a) => a.mercado.gapEurMonth)),
      abaixo,
    },
    totais: {
      rendaContratada: sum(activeContracts.map((c) => c.rent)),
      recebido12m: sum(fluxo.map((m) => m.recebido)),
      vptTotal: sum(correntes.map((a) => a.property.vpt)),
    },
  };
}

/** A faixa de um contrato: uma célula por mês da janela. Sem contrato ativo, a faixa é
 *  toda `fora` — a fração existe, simplesmente não há nada a cobrar. */
function buildFaixa(
  contract: Contract | null,
  sumsByContract: Map<string, Map<string, number>>,
  expectedByContract: Record<string, number>,
  months: string[],
  horizon: string | null,
): MonthCellData[] {
  if (!contract) {
    return months.map((month) => ({ month, status: "fora" as const, paid: 0, expected: 0 }));
  }
  const sums = sumsByContract.get(contract.id) ?? new Map<string, number>();
  const expected = expectedByContract[contract.id] ?? contract.rent;
  return months.map((month) => {
    const paid = sums.get(month) ?? 0;
    return {
      month,
      paid,
      expected,
      status: monthCellStatus({
        month,
        paid,
        expected,
        activeInMonth: contractActiveInMonth(contract, month),
        horizon,
      }),
    };
  });
}

/** Data local em ISO. Local, e não UTC, porque todo o domínio compara com `todayISO()`
 *  de format.ts, que também é local — misturar os dois dava saltos de um dia. */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Meses de `a` até `b`, ambos "YYYY-MM". Negativo se `b` for anterior. */
function mesesEntre(a: string, b: string): number {
  const ya = parseInt(a.slice(0, 4), 10);
  const ma = parseInt(a.slice(5, 7), 10);
  const yb = parseInt(b.slice(0, 4), 10);
  const mb = parseInt(b.slice(5, 7), 10);
  return (yb - ya) * 12 + (mb - ma);
}
