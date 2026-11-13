import { taxaAutonoma } from "../irs";
import type { Expense } from "../types";
import type { AnoDoSenhorio } from "./ano";

export type LinhaDePoupanca = {
  contratoId: string;
  propertyId: string;
  senhorio: string;
  taxaAtual: number;
  taxaPossivel: number;
  falta: string | null;
  eurosPorAno: number;
};

const PRAZO_EM_FALTA = "registar o prazo do contrato";
const round2 = (valor: number): number => Math.round(valor * 100) / 100;

// Sem prazo, o Ano só fornece identidades no Anexo F; prazoPorConfirmar é uma contagem.
export function poupancaPorContrato(anos: AnoDoSenhorio[]): LinhaDePoupanca[] {
  return anos.flatMap((ano) => {
    const elegiveis = new Map(ano.elegiveisArt72.map((e) => [e.contract.id, e]));
    const linhas: LinhaDePoupanca[] = ano.anexoF
      .filter((r) => r.reduced.uso === "habitacao" && !elegiveis.has(r.contractId))
      .map((r) => {
        const reduzida = r.reduced;
        const falta = reduzida.eligibleRate !== null ? null :
          reduzida.durationYears === null ? PRAZO_EM_FALTA : "prazo inferior a 5 anos";
        return {
          contratoId: r.contractId, propertyId: r.propertyId, senhorio: ano.landlord.name,
          taxaAtual: r.taxaAutonoma, taxaPossivel: reduzida.eligibleRate ?? r.taxaAutonoma,
          falta, eurosPorAno: reduzida.annualSavings ?? 0,
        };
      });
    for (const e of elegiveis.values()) {
      linhas.push({
        contratoId: e.contract.id, propertyId: e.contract.property_id, senhorio: ano.landlord.name,
        taxaAtual: taxaAutonoma(e.contract, "habitação"), taxaPossivel: e.rate,
        falta: null, eurosPorAno: e.savings,
      });
    }
    return linhas;
  });
}

export type DespesaEmFalta = {
  propertyId: string;
  categoria: string;
  /** Ano em que falta o lançamento. */
  ano: number;
  valorAnterior: number;
};

export function despesasEmFalta(
  despesas: Expense[], propertyIds: string[], ano: number,
): DespesaEmFalta[] {
  const ids = new Set(propertyIds);
  const anteriores = new Map<string, DespesaEmFalta>();
  const atuais = new Set<string>();
  for (const d of despesas) {
    if (d.origem !== "registada" || !d.property_id || !ids.has(d.property_id) ||
      !["imi", "condominio", "seguro"].includes(d.category)) continue;
    const chave = `${d.property_id}:${d.category}`;
    if (d.expense_date.startsWith(`${ano}-`)) atuais.add(chave);
    if (!d.expense_date.startsWith(`${ano - 1}-`)) continue;
    const linha = anteriores.get(chave) ?? {
      propertyId: d.property_id, categoria: d.category, ano, valorAnterior: 0,
    };
    linha.valorAnterior += d.amount;
    anteriores.set(chave, linha);
  }
  return [...anteriores].filter(([chave]) => !atuais.has(chave))
    .map(([, linha]) => ({ ...linha, valorAnterior: round2(linha.valorAnterior) }))
    .sort((a, b) => b.valorAnterior - a.valorAnterior ||
      a.propertyId.localeCompare(b.propertyId) || a.categoria.localeCompare(b.categoria));
}

export function resumoDaPoupanca(linhas: LinhaDePoupanca[]): { realizavel: number; porConfirmar: number } {
  return {
    realizavel: round2(linhas.filter((l) => l.falta === null).reduce((s, l) => s + l.eurosPorAno, 0)),
    porConfirmar: round2(linhas.filter((l) => l.falta === PRAZO_EM_FALTA)
      .reduce((s, l) => s + l.eurosPorAno, 0)),
  };
}
