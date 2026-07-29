// O ANO fiscal: uma leitura, um cálculo (PLANO.md §3, Fase 5).
//
// Vive fora do `snapshot.ts` de propósito. O snapshot é a carteira HOJE e não carrega
// recibos de anos passados — carregá-los punha ~5.800 linhas em cada página da app para
// servir uma superfície que se abre de março a junho. O Ano paga a sua própria leitura, e
// só ele.
//
// Tudo o que é fiscal continua a vir do `irs.ts`, que já estava testado (incluindo o bug
// B1, em que o Anexo F somava a retenção duas vezes). Aqui só se junta e se ordena.

import {
  aimiExposure,
  anexoFRows,
  computeLandlordFiscalYear,
  reducedRateEligibility,
  type AimiExposure,
  type AnexoFRow,
  type IrsReceiptInput,
  type LandlordFiscalYear,
} from "../irs";
import { paginateAll } from "../paginate";
import { createClient } from "../supabase/server";
import { todayISO } from "../format";
import type {
  Contract,
  Expense,
  Landlord,
  Property,
  PropertyOwner,
  Receipt,
} from "../types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type PropriedadeDoAno = Pick<
  Property,
  "id" | "name" | "matriz_article" | "typology" | "vpt" | "status"
>;

export interface ContratoElegivel {
  contract: Contract;
  propertyName: string;
  /** Taxa do art. 72.º a que o contrato tem direito, e quanto poupa por ano. */
  rate: number;
  savings: number;
  anos: number;
}

export interface AnoDoSenhorio {
  landlord: Pick<Landlord, "id" | "name">;
  fy: LandlordFiscalYear;
  anexoF: AnexoFRow[];
  aimi: AimiExposure;
  elegiveisArt72: ContratoElegivel[];
  /** Poupança anual total se todos os contratos elegíveis forem comunicados à AT. */
  poupancaArt72: number;
}

export interface DadosDoAno {
  ano: number;
  anos: number[];
  senhorios: Array<Pick<Landlord, "id" | "name">>;
  propriedades: PropriedadeDoAno[];
  /** Despesas do ano, linhas completas: o bloco #despesas edita-as. */
  despesas: Expense[];
  porSenhorio: AnoDoSenhorio[];
}

/** Anos oferecidos no seletor. 5 chega: antes disso não há dados importados nesta carteira. */
export const JANELA_ANOS = 5;

export async function carregarAno(anoPedido: number): Promise<DadosDoAno> {
  const supabase: SupabaseClient = await createClient();
  const anoCorrente = new Date().getFullYear();
  const anos = Array.from({ length: JANELA_ANOS }, (_, i) => anoCorrente - i);
  const ano = anos.includes(anoPedido) ? anoPedido : anoCorrente;
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;

  const [landlordsQ, ownersQ, propsQ, contractsQ, receiptsQ, expensesQ] = await Promise.all([
    supabase.from("landlords").select("id,name").order("name"),
    supabase.from("property_owners").select("*"),
    supabase.from("properties").select("id,name,matriz_article,typology,vpt,status"),
    supabase.from("contracts").select("*"),
    // Recibos do ano por DATA DE EMISSÃO: é o critério do Anexo F (regime de caixa), e é
    // o mesmo que o /irs usava — não mudar para ref_month sem mudar a declaração.
    // PAGINADO: o .limit() nao passa por cima do max-rows (~1000) do PostgREST, e um recibo
    // que escape faz o Anexo F declarar menos renda do que houve.
    paginateAll<IrsReceiptInput>(async (from, to) => {
      const { data, error } = await supabase
        .from("receipts")
        .select("property_id,amount,withholding,issue_date")
        .gte("issue_date", inicio)
        .lte("issue_date", fim)
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as IrsReceiptInput[];
    }),
    supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", inicio)
      .lte("expense_date", fim)
      .order("expense_date", { ascending: false }),
  ]);

  const senhorios = (landlordsQ.data ?? []) as Array<Pick<Landlord, "id" | "name">>;
  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const propriedades = (propsQ.data ?? []) as PropriedadeDoAno[];
  const contratos = (contractsQ.data ?? []) as Contract[];
  const recibos = receiptsQ;
  const despesas = (expensesQ.data ?? []) as Expense[];
  const porId = new Map(propriedades.map((p) => [p.id, p]));
  const hoje = todayISO();

  const porSenhorio = senhorios.map((landlord) => {
    const quotas = new Map<string, number>();
    for (const o of owners) {
      if (o.landlord_id === landlord.id) quotas.set(o.property_id, o.quota ?? 100);
    }

    // Contratos ATIVOS elegíveis à taxa reduzida — olham para o presente, não para o ano
    // fiscal: é uma comunicação a fazer à AT hoje, mesmo que o contrato não tenha rendas
    // neste ano.
    const elegiveis: ContratoElegivel[] = contratos
      .filter((c) => c.status === "ativo" && quotas.has(c.property_id))
      .map((c) => {
        const r = reducedRateEligibility(
          c,
          porId.get(c.property_id)?.typology ?? null,
          quotas.get(c.property_id) ?? 100,
          hoje,
        );
        return {
          contract: c,
          propertyName: porId.get(c.property_id)?.name ?? "fração",
          rate: r.eligibleRate ?? 0,
          savings: r.annualSavings ?? 0,
          anos: r.durationYears ?? 0,
        };
      })
      .filter((e) => e.rate > 0 && e.savings > 0)
      .sort((a, b) => b.savings - a.savings);

    return {
      landlord,
      fy: computeLandlordFiscalYear(landlord.id, ano, owners, recibos, despesas),
      anexoF: anexoFRows(landlord.id, ano, owners, contratos, porId, recibos, despesas, hoje),
      aimi: aimiExposure(landlord.id, owners, porId),
      elegiveisArt72: elegiveis,
      poupancaArt72: elegiveis.reduce((a, e) => a + e.savings, 0),
    };
  });

  return { ano, anos, senhorios, propriedades, despesas, porSenhorio };
}
