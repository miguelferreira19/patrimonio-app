// Ficha de arrendatário (V3). Módulo PURO: sem I/O, sem React — lê o snapshot que já
// existe e não faz uma única query nova.
//
// A ARMADILHA DO INQUILINO (V3.md): o arrendatário NÃO é uma entidade. É
// `contracts.tenant_name`, texto livre, com `tenant_nif` frequentemente nulo. Não há chave
// estável. Agrupa-se por NIF quando existe, senão por nome normalizado — e diz-se qual
// dos dois foi, porque um agrupamento por nome pode juntar homónimos. Nunca fuzzy match.
//
// A chave é a MESMA de `concentracao().porInquilino` em renda.ts (`nif:` / `nome:`), de
// propósito: é o que permite ir da linha de concentração da /analise para esta ficha.

import type { Contract, Property } from "../types";
import type { Ativo, Snapshot } from "./snapshot";
import { DEBT_CAP_MONTHS, type ArrearsRow } from "../arrears";
import { addMonthsKey } from "../format";
import { emAtrasoDaCarteira } from "./insights";
import type { PerdaContrato } from "./risk";

/** Chave de agrupamento de um arrendatário. `nif:` é estável; `nome:` é o melhor esforço. */
export function chaveDoInquilino(c: Pick<Contract, "tenant_nif" | "tenant_name">): string {
  const nif = c.tenant_nif?.trim();
  return nif ? `nif:${nif}` : `nome:${normalizarNome(c.tenant_name)}`;
}

export interface ContratoDoInquilino {
  contract: Contract;
  property: Property;
  /** Linha de atrasos — só existe para o contrato ATIVO da fração. */
  arrears: ArrearsRow | null;
  risco: PerdaContrato | null;
}

export interface FichaInquilino {
  chave: string;
  /** O nome tal como está no contrato mais recente. */
  nome: string;
  nif: string | null;
  /** true quando o agrupamento foi por NOME: pode juntar homónimos. */
  porNome: boolean;
  contratos: ContratoDoInquilino[];
  ativos: number;
  cessados: number;
  /** Σ renda dos contratos ativos. */
  rendaMensal: number;
  /** Σ pagamentos da janela do snapshot (12 meses), não o histórico todo. */
  recebido12m: number;
  /** Primeira data de início conhecida; null se nenhum contrato tem data. */
  desde: string | null;
  /** Pior severidade entre os contratos ativos. */
  severidade: ArrearsRow["severity"] | null;
  /** Σ dívida estimada dos contratos ativos. */
  divida: number;
  /** Média das probabilidades de pagar, ponderada pela renda. null sem contratos ativos. */
  pPagar: number | null;
}

const ORDEM_SEVERIDADE: ArrearsRow["severity"][] = [
  "critico", "atraso", "atencao", "ritmo_proprio", "ok",
];

/** Todas as fichas, da maior renda ativa para a menor. */
export function fichasDeInquilinos(snap: Snapshot): FichaInquilino[] {
  const recebidoPorContrato = new Map<string, number>();
  for (const p of snap.pagamentosRecentes) {
    recebidoPorContrato.set(p.contract_id, (recebidoPorContrato.get(p.contract_id) ?? 0) + p.amount);
  }

  const porChave = new Map<string, ContratoDoInquilino[]>();
  for (const a of snap.ativos) {
    for (const c of a.contracts) {
      const chave = chaveDoInquilino(c);
      const linha = linhaDoContrato(a, c);
      const atual = porChave.get(chave);
      if (atual) atual.push(linha);
      else porChave.set(chave, [linha]);
    }
  }

  const fichas: FichaInquilino[] = [];
  for (const [chave, contratos] of porChave) {
    // Mais recente primeiro: é de lá que sai o nome a mostrar (a grafia mais atual).
    contratos.sort((x, y) => (y.contract.start_date ?? "").localeCompare(x.contract.start_date ?? ""));
    const ativos = contratos.filter((c) => c.contract.status === "ativo");
    const datas = contratos.map((c) => c.contract.start_date).filter((d): d is string => !!d);

    let severidade: ArrearsRow["severity"] | null = null;
    for (const c of ativos) {
      const s = c.arrears?.severity;
      if (!s) continue;
      if (severidade === null || ORDEM_SEVERIDADE.indexOf(s) < ORDEM_SEVERIDADE.indexOf(severidade)) {
        severidade = s;
      }
    }

    const rendaMensal = ativos.reduce((acc, c) => acc + c.contract.rent, 0);
    const comRisco = ativos.filter((c) => c.risco !== null);
    const pesoTotal = comRisco.reduce((acc, c) => acc + c.contract.rent, 0);

    fichas.push({
      chave,
      nome: contratos[0].contract.tenant_name,
      nif: contratos[0].contract.tenant_nif?.trim() || null,
      porNome: chave.startsWith("nome:"),
      contratos,
      ativos: ativos.length,
      cessados: contratos.length - ativos.length,
      rendaMensal,
      recebido12m: contratos.reduce((acc, c) => acc + (recebidoPorContrato.get(c.contract.id) ?? 0), 0),
      desde: datas.length > 0 ? datas.sort()[0] : null,
      severidade,
      // Sem os de ritmo próprio, como em emAtrasoDaCarteira: o mesmo número da Cobranças.
      divida: ativos.reduce(
        (acc, c) => acc + (c.arrears && c.arrears.severity !== "ritmo_proprio" ? c.arrears.debt : 0),
        0,
      ),
      pPagar:
        pesoTotal > 0
          ? comRisco.reduce((acc, c) => acc + c.risco!.p.p * c.contract.rent, 0) / pesoTotal
          : null,
    });
  }

  return fichas.sort((a, b) => b.rendaMensal - a.rendaMensal || b.recebido12m - a.recebido12m);
}

export function fichaDoInquilino(snap: Snapshot, chave: string): FichaInquilino | undefined {
  return fichasDeInquilinos(snap).find((f) => f.chave === chave);
}

export interface ContratoEmAtraso {
  contract: Contract;
  property: Property;
  meses: number;
  divida: number;
  /** Primeiro mês por pagar ("YYYY-MM-01"). */
  desde: string;
  /** Último mês totalmente pago; null se nunca houve um. */
  ultimoPago: string | null;
}

export interface Devedor {
  chave: string;
  nome: string;
  porNome: boolean;
  divida: number;
  /** O mês por pagar mais antigo, entre os contratos dele. */
  desde: string;
  contratos: ContratoEmAtraso[];
}

/** Quem deve, agrupado por inquilino, do maior valor para o menor (PLANO_CLAREZA.md 1.4).
 *  Parte de `emAtrasoDaCarteira`, a MESMA lista do Hoje e dos Imóveis, por isso o total é
 *  igual em todo o lado. */
export function devedores(snap: Pick<Snapshot, "arrears" | "ativos">): Devedor[] {
  const porContrato = new Map(
    snap.ativos.flatMap((a) => (a.activeContract ? [[a.activeContract.id, a] as const] : [])),
  );
  const porChave = new Map<string, Devedor>();
  for (const r of emAtrasoDaCarteira(snap)) {
    const a = porContrato.get(r.contractId);
    if (!a?.activeContract) continue;
    const c = a.activeContract;
    // `months24` acaba no último mês devido DESTE contrato (a fronteira da fonte dele).
    const fim = r.months24[r.months24.length - 1].month;
    const meses = Math.min(r.streak, DEBT_CAP_MONTHS);
    const linha: ContratoEmAtraso = {
      contract: c,
      property: a.property,
      meses,
      divida: r.debt,
      desde: addMonthsKey(fim, -(meses - 1)),
      ultimoPago: r.lastPaidMonth,
    };
    const chave = chaveDoInquilino(c);
    const d = porChave.get(chave);
    if (d) {
      d.divida += linha.divida;
      d.contratos.push(linha);
      if (linha.desde < d.desde) d.desde = linha.desde;
    } else {
      porChave.set(chave, { chave, nome: c.tenant_name, porNome: chave.startsWith("nome:"), divida: linha.divida, desde: linha.desde, contratos: [linha] });
    }
  }
  return Array.from(porChave.values())
    .map((d) => ({ ...d, contratos: d.contratos.sort((x, y) => y.divida - x.divida) }))
    .sort((a, b) => b.divida - a.divida);
}

function linhaDoContrato(a: Ativo, c: Contract): ContratoDoInquilino {
  const ehAtivo = a.activeContract?.id === c.id;
  return {
    contract: c,
    property: a.property,
    // `arrears` e `risco` do snapshot são SEMPRE do contrato ativo da fração: atribuí-los a
    // um contrato cessado seria pôr o atraso de outra pessoa na ficha desta.
    arrears: ehAtivo ? a.arrears : null,
    risco: ehAtivo ? a.risco : null,
  };
}

/** Minúsculas, sem acentos, espaços colapsados. Igual ao de renda.ts (as duas chaves têm
 *  de ser a mesma string), mas repetido porque lá é privado e isto é formatação. */
function normalizarNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
