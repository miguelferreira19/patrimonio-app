import type { SupabaseClient } from "@supabase/supabase-js";
import type { Observacao } from "./controlo";
import { paginateAll } from "./paginate";
import { linhas } from "./supabase/dados";

export type ResultadoDasObservacoes =
  | { observacoes: Observacao[]; tabelaEmFalta: false }
  | { observacoes: []; tabelaEmFalta: true };
type LinhaObservacao = {
  receipt_key: string; pf_contract_no: string; account: string;
  period_start: string | null; period_end: string | null; received_date: string | null;
  amount: number | string; withholding: number | string;
  state: Observacao["state"]; first_seen: string | null;
};
type ErroDaLeitura = { code?: string; message: string };
const TABELA = "receipt_observations";
const COLUNAS = "receipt_key,pf_contract_no,account,period_start,period_end,received_date,amount,withholding,state,first_seen";

function tabelaAusente(erro: ErroDaLeitura | null): boolean {
  return !!erro && ["42P01", "PGRST205"].includes(erro.code ?? "") && erro.message.includes(TABELA);
}
function observacao(r: LinhaObservacao): Observacao {
  return { receiptKey: r.receipt_key, contrato: r.pf_contract_no, conta: r.account,
    periodStart: r.period_start ?? "", periodEnd: r.period_end ?? "", receivedDate: r.received_date,
    amount: Number(r.amount), withholding: Number(r.withholding), state: r.state, firstSeen: r.first_seen };
}

export async function carregarObservacoes(supabase: SupabaseClient): Promise<ResultadoDasObservacoes> {
  let tabelaEmFalta = false;
  try {
    const rows = await paginateAll<LinhaObservacao>(async (de, ate) => {
      const q = await supabase.from(TABELA).select(COLUNAS).order("id").range(de, ate);
      if (tabelaAusente(q.error)) {
        tabelaEmFalta = true;
        return [];
      }
      return linhas<LinhaObservacao>(q, TABELA);
    });
    return tabelaEmFalta ? { observacoes: [], tabelaEmFalta: true } :
      { observacoes: rows.map(observacao), tabelaEmFalta: false };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    if (mensagem.startsWith(`Falhou a leitura de ${TABELA}:`)) throw erro;
    throw new Error(`Falhou a leitura de ${TABELA}: ${mensagem}`);
  }
}
