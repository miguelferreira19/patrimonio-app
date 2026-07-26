// Análise fina da renda (V3, Fase F3, ver V3.md).
//
// Porque existe: a V2 olhava para 12 meses de histórico quando a base tem uma dezena de
// anos de série mensal. Este módulo lê os pagamentos todos e devolve a leitura ao ano
// (acumulado, série anual, crescimento), quem está a segurar a renda parada e quem
// concentra o risco (inquilino ou fração). Módulo PURO: sem I/O, sem React, sem
// `new Date()` escondido, o relógio entra sempre por parâmetro `hoje: Date` (mesma
// convenção de `snapshot.ts` e `arrears.ts`).
//
// REGRA: nada de regra de negócio nova aqui além da agregação. A elegibilidade de
// atualização de renda e o coeficiente vêm de `rentUpdateEligibility` (calc.ts); o
// contrato ativo num mês vem de `contractActiveInMonth` (calc.ts).

import {
  contractActiveInMonth,
  rentUpdateEligibility,
  sum,
  type RollPayment,
} from "../calc";
import { addMonthsKey, lastMonthsKeys, monthKeyFromDate } from "../format";
import type { Contract, RentUpdate, UpdateCoefficient } from "../types";

// ---------------------------------------------------------------------------
// 1. Acumulado do ano (este ano vs ano anterior, linha a linha)
// ---------------------------------------------------------------------------

export interface PontoAcumulado {
  /** Chave do mês do ANO CORRENTE, no formato "YYYY-MM-01" (a mesma convenção do
   *  resto da app: `monthKeyFromDate`/`addMonthsKey`). Serve para o eixo do gráfico. */
  mes: string;
  /** Acumulado de janeiro até este mês, no ano corrente. `null` num mês que ainda não
   *  começou, para o gráfico não desenhar uma linha a cair para zero. */
  esteAno: number | null;
  /** Acumulado de janeiro até este mês, no ano anterior. Sempre completo. */
  anoAnterior: number;
}

/**
 * 12 pontos (janeiro a dezembro) com o total ACUMULADO de pagamentos do ano corrente e
 * do ano anterior, para o mesmo mês. `esteAno` fica a `null` nos meses ainda por vir do
 * ano corrente; `anoAnterior` está sempre completo porque o ano já acabou.
 */
export function acumuladoDoAno(payments: RollPayment[], hoje: Date): PontoAcumulado[] {
  const anoAtual = hoje.getFullYear();
  const jan1DoAno = `${anoAtual}-01-01`;
  const mesAtualKey = monthKeyFromDate(hoje).slice(0, 7); // "YYYY-MM"

  const porMes = new Map<string, number>();
  for (const p of payments) {
    const chave = p.ref_month.slice(0, 7); // "YYYY-MM", ignora o dia
    porMes.set(chave, (porMes.get(chave) ?? 0) + p.amount);
  }

  const pontos: PontoAcumulado[] = [];
  let acumEste = 0;
  let acumAnterior = 0;
  for (let i = 0; i < 12; i++) {
    const mesChave = addMonthsKey(jan1DoAno, i); // "YYYY-MM-01" do ano corrente
    const chaveEste = mesChave.slice(0, 7);
    const chaveAnterior = `${anoAtual - 1}-${chaveEste.slice(5, 7)}`;

    acumEste += porMes.get(chaveEste) ?? 0;
    acumAnterior += porMes.get(chaveAnterior) ?? 0;

    const decorrido = chaveEste <= mesAtualKey;
    pontos.push({
      mes: mesChave,
      esteAno: decorrido ? acumEste : null,
      anoAnterior: acumAnterior,
    });
  }
  return pontos;
}

// ---------------------------------------------------------------------------
// 2. Série anual e crescimento
// ---------------------------------------------------------------------------

export interface AnoRenda {
  ano: number;
  recebido: number;
  /** Meses do ano em que a carteira teve pelo menos um contrato ativo, com teto na
   *  fronteira de dados (o maior mês visto nos pagamentos). É o denominador honesto de
   *  `rendaMediaMensal`: um mês sem nenhum contrato ativo (antes do primeiro arrendamento,
   *  ou ainda por vir no ano corrente) não deve diluir a média. */
  meses: number;
  rendaMediaMensal: number;
  /** true no ano corrente (o mais recente com dados) e em qualquer ano com menos de 12
   *  meses de dados (o primeiro ano da carteira, tipicamente). */
  parcial: boolean;
}

/**
 * Série anual de recebido, do primeiro ano com pagamentos até ao ano corrente.
 *
 * "Ano corrente" aqui é o ano mais recente presente nos PRÓPRIOS pagamentos (a fronteira
 * de dados, o mesmo princípio de `dataHorizonMonth` em arrears.ts), nunca o relógio do
 * sistema: este módulo não recebe `hoje` para esta função de propósito, é dado que se lê
 * dos próprios dados. `contracts` entra para bater o `meses` com meses em que a carteira
 * esteve mesmo a operar (via `contractActiveInMonth`), e não com meses em que por acaso
 * caiu um pagamento.
 */
export function serieAnual(payments: RollPayment[], contracts: Contract[]): AnoRenda[] {
  if (payments.length === 0) return [];

  const recebidoPorAno = new Map<number, number>();
  let horizonMes = ""; // "YYYY-MM", o maior mês visto nos pagamentos
  for (const p of payments) {
    const chave = p.ref_month.slice(0, 7);
    const ano = parseInt(chave.slice(0, 4), 10);
    recebidoPorAno.set(ano, (recebidoPorAno.get(ano) ?? 0) + p.amount);
    if (chave > horizonMes) horizonMes = chave;
  }

  const anos = Array.from(recebidoPorAno.keys()).sort((a, b) => a - b);
  const anoInicio = anos[0];
  const anoCorrente = anos[anos.length - 1];

  const out: AnoRenda[] = [];
  for (let ano = anoInicio; ano <= anoCorrente; ano++) {
    // No ano corrente o mês final é a fronteira de dados; nos anos fechados são os 12
    // meses do calendário, mesmo que o ano tenha começado depois de janeiro.
    const ultimoMes = ano === anoCorrente ? horizonMes : `${ano}-12`;

    let meses = 0;
    for (let m = 1; m <= 12; m++) {
      const chave = `${ano}-${String(m).padStart(2, "0")}`;
      if (chave > ultimoMes) break;
      const monthKeyDoMes = `${chave}-01`;
      if (contracts.some((c) => contractActiveInMonth(c, monthKeyDoMes))) meses += 1;
    }

    const recebido = recebidoPorAno.get(ano) ?? 0;
    out.push({
      ano,
      recebido,
      meses,
      rendaMediaMensal: meses > 0 ? recebido / meses : 0,
      parcial: ano === anoCorrente || meses < 12,
    });
  }
  return out;
}

export interface Crescimento {
  /** Taxa de crescimento anual composta, entre o primeiro e o último ano COMPLETOS.
   *  `null` com menos de dois anos completos: não há CAGR de um ano só. */
  cagr: number | null;
  porAno: Array<{ ano: number; variacao: number | null }>;
}

/**
 * Crescimento a partir de uma `serieAnual`. O CAGR ignora anos parciais de propósito:
 * comparar um ano corrente ainda a meio com um ano fechado inflaciona ou deflaciona a
 * taxa consoante a altura do ano em que se olha para o número.
 */
export function crescimento(serie: AnoRenda[]): Crescimento {
  const porAno = serie.map((a, i) => {
    if (i === 0) return { ano: a.ano, variacao: null };
    const anterior = serie[i - 1];
    const variacao = anterior.recebido > 0 ? a.recebido / anterior.recebido - 1 : null;
    return { ano: a.ano, variacao };
  });

  const completos = serie.filter((a) => !a.parcial);
  let cagr: number | null = null;
  if (completos.length >= 2) {
    const primeiro = completos[0];
    const ultimo = completos[completos.length - 1];
    const anosEntre = ultimo.ano - primeiro.ano;
    if (anosEntre > 0 && primeiro.recebido > 0) {
      cagr = (ultimo.recebido / primeiro.recebido) ** (1 / anosEntre) - 1;
    }
  }
  return { cagr, porAno };
}

// ---------------------------------------------------------------------------
// 3. Rendas paradas
// ---------------------------------------------------------------------------

export interface RendaParada {
  contractId: string;
  tenant: string;
  rendaAtual: number;
  mesesSemAtualizar: number;
  rendaSugerida: number | null;
  ganhoAnual: number;
}

/**
 * Contratos ativos sem atualização de renda há mais de `mesesMin` meses (24 por defeito,
 * o dobro da elegibilidade dos 12 meses de `rentUpdateEligibility`: aqui não se procura
 * quem já pode atualizar, procura-se quem está parado há MUITO tempo). Reusa a data-base
 * e a renda sugerida de `rentUpdateEligibility`; só acrescenta a contagem de meses e o
 * ganho anual, que essa função não devolve.
 */
export function rendasParadas(
  contracts: Contract[],
  rentUpdates: RentUpdate[],
  coefficients: UpdateCoefficient[],
  hoje: Date,
  mesesMin = 24,
): RendaParada[] {
  const hojeISO = isoDateLocal(hoje);
  const out: RendaParada[] = [];

  for (const c of contracts) {
    if (c.status !== "ativo") continue;
    const elig = rentUpdateEligibility(c, rentUpdates, coefficients, hojeISO);
    if (!elig.baseDate) continue;

    const mesesSemAtualizar = mesesEntreDatas(elig.baseDate, hojeISO);
    if (mesesSemAtualizar < mesesMin) continue;

    const rendaSugerida = elig.suggestedRent;
    const ganhoAnual = rendaSugerida !== null ? (rendaSugerida - c.rent) * 12 : 0;

    out.push({
      contractId: c.id,
      tenant: c.tenant_name,
      rendaAtual: c.rent,
      mesesSemAtualizar,
      rendaSugerida,
      ganhoAnual,
    });
  }

  return out.sort((a, b) => b.ganhoAnual - a.ganhoAnual);
}

// ---------------------------------------------------------------------------
// 4. Concentração (inquilino e fração)
// ---------------------------------------------------------------------------

export interface LinhaConcentracao {
  chave: string;
  nome: string;
  recebido12m: number;
  /** Fração do total recebido nos últimos 12 meses, de 0 a 1. */
  quota: number;
}

export interface Concentracao {
  porInquilino: LinhaConcentracao[];
  /** Chave e nome são o `property_id`: este módulo não recebe a lista de frações, quem
   *  consome faz o join com o nome real se precisar (o número é o que importa aqui). */
  porFracao: LinhaConcentracao[];
  /** Índice de Herfindahl-Hirschman por inquilino: soma dos quadrados das quotas, de 0
   *  (disperso) a 1 (um único inquilino leva tudo). */
  hhi: number;
  /** Quantos grupos de `porInquilino` se formaram por nome normalizado em vez de NIF: é
   *  a incerteza que a UI tem de declarar (ver a armadilha do inquilino em V3.md). */
  agrupadosPorNome: number;
}

/**
 * Concentração de receita dos últimos 12 meses (a partir de `hoje`), por inquilino e por
 * fração.
 *
 * ARMADILHA DO INQUILINO: `contracts.tenant_name` é texto livre e `tenant_nif` é
 * frequentemente nulo, não há chave estável. Agrupa-se por NIF quando existe; senão por
 * nome normalizado (minúsculas, sem acentos, espaços colapsados). Nunca fuzzy match: dois
 * nomes parecidos sem NIF ficam em linhas separadas, de propósito.
 */
export function concentracao(
  contracts: Contract[],
  payments: RollPayment[],
  hoje: Date,
): Concentracao {
  const janela = new Set(lastMonthsKeys(12, monthKeyFromDate(hoje)).map((m) => m.slice(0, 7)));

  const recebidoPorContrato = new Map<string, number>();
  for (const p of payments) {
    if (!janela.has(p.ref_month.slice(0, 7))) continue;
    recebidoPorContrato.set(p.contract_id, (recebidoPorContrato.get(p.contract_id) ?? 0) + p.amount);
  }

  const contractsById = new Map(contracts.map((c) => [c.id, c]));
  const total = sum(Array.from(recebidoPorContrato.values()));

  const porInquilinoMap = new Map<string, { nome: string; recebido: number; porNome: boolean }>();
  const porFracaoMap = new Map<string, number>();

  for (const [contractId, recebido] of recebidoPorContrato) {
    const c = contractsById.get(contractId);
    if (!c) continue;

    const nif = c.tenant_nif?.trim();
    const chaveInquilino = nif ? `nif:${nif}` : `nome:${normalizarNome(c.tenant_name)}`;
    const atual = porInquilinoMap.get(chaveInquilino);
    if (atual) atual.recebido += recebido;
    else porInquilinoMap.set(chaveInquilino, { nome: c.tenant_name, recebido, porNome: !nif });

    porFracaoMap.set(c.property_id, (porFracaoMap.get(c.property_id) ?? 0) + recebido);
  }

  const porInquilino: LinhaConcentracao[] = Array.from(porInquilinoMap.entries())
    .map(([chave, v]) => ({
      chave,
      nome: v.nome,
      recebido12m: v.recebido,
      quota: total > 0 ? v.recebido / total : 0,
    }))
    .sort((a, b) => b.recebido12m - a.recebido12m);

  const porFracao: LinhaConcentracao[] = Array.from(porFracaoMap.entries())
    .map(([chave, recebido]) => ({
      chave,
      nome: chave,
      recebido12m: recebido,
      quota: total > 0 ? recebido / total : 0,
    }))
    .sort((a, b) => b.recebido12m - a.recebido12m);

  const hhi = porInquilino.reduce((acc, l) => acc + l.quota ** 2, 0);
  const agrupadosPorNome = Array.from(porInquilinoMap.values()).filter((v) => v.porNome).length;

  return { porInquilino, porFracao, hhi, agrupadosPorNome };
}

// ---------------------------------------------------------------------------
// Utilitários locais (formatação de data, não regra de negócio)
// ---------------------------------------------------------------------------

/** Data local em ISO "YYYY-MM-DD", a mesma convenção de `isoDate` em snapshot.ts e de
 *  `todayISO()` em format.ts (local, não UTC). Repetido aqui porque nenhum dos dois está
 *  exportado, e isto é só formatação, não lógica de domínio. */
function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Meses inteiros decorridos entre duas datas ISO, contando só quando o dia do mês já
 *  passou (a mesma noção de "12 meses depois" que `rentUpdateEligibility` usa). */
function mesesEntreDatas(baseISO: string, hojeISO: string): number {
  const base = new Date(`${baseISO.slice(0, 10)}T00:00:00Z`);
  const agora = new Date(`${hojeISO}T00:00:00Z`);
  let meses =
    (agora.getUTCFullYear() - base.getUTCFullYear()) * 12 +
    (agora.getUTCMonth() - base.getUTCMonth());
  if (agora.getUTCDate() < base.getUTCDate()) meses -= 1;
  return Math.max(0, meses);
}

/** Normalização de nome para a chave de agrupamento sem NIF: minúsculas, sem acentos,
 *  espaços colapsados. Nunca fuzzy match, só isto. */
function normalizarNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
