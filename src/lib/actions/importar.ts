"use server";

// Import de recibos do Portal com DIFF antes de escrever (PLANO.md §7.4, Fase 6).
//
// Regras de segurança, e a razão de este caminho existir em vez de se alargar o wizard:
//
//   1. `preverImport` NÃO ESCREVE NADA. Lê o estado e devolve o plano.
//   2. `aplicarImport` RECALCULA o plano no servidor a partir das mesmas linhas. Nunca
//      confia no plano que o browser mandou — senão bastava adulterá-lo para escrever o
//      que se quisesse.
//   3. Só INSERE. Nunca faz update nem delete. Um recibo que já existe com outro valor é
//      uma divergência: aparece no diff e resolve-se à mão.
//   4. NÃO cria frações nem contratos. O wizard antigo criava, e é assim que entra lixo
//      na base — uma matriz mal lida virava uma fração nova. O plano NOMEIA o que falta e
//      a criação é uma decisão humana.
//   5. Os pagamentos só se inserem onde ainda não há nenhum para aquele contrato-mês: um
//      pagamento marcado à mão vence sempre o inferido do recibo.
//
// O pipeline Python (`dados/gerar_sql_import.py`) continua a ser a reversão oficial.

import { revalidatePath } from "next/cache";
import { fail, requireAdmin, type ActionResult } from "./util";
import { paginateAll } from "../paginate";
import {
  construirPlano,
  type EstadoAtual,
  type LinhaRecibo,
  type PlanoDeImportacao,
} from "../import/plano";

/** Lê o estado necessário para comparar. `receipts` tem >5000 linhas: pagina-se sempre
 *  (a armadilha das 1000 linhas do PostgREST está no CLAUDE.md). */
async function lerEstado(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
): Promise<EstadoAtual> {
  const [recibos, props, contratos] = await Promise.all([
    paginateAll<{ receipt_number: string | null; amount: number }>(async (from, to) => {
      const { data, error } = await supabase
        .from("receipts")
        .select("receipt_number,amount")
        .not("receipt_number", "is", null)
        .order("receipt_number", { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ receipt_number: string | null; amount: number }>;
    }),
    supabase.from("properties").select("id,matriz_article"),
    supabase.from("contracts").select("id,pf_contract_no"),
  ]);

  const mapa = new Map<string, number>();
  for (const r of recibos) if (r.receipt_number) mapa.set(r.receipt_number, Number(r.amount));

  return {
    recibos: mapa,
    matrizes: new Set(
      ((props.data ?? []) as Array<{ matriz_article: string | null }>)
        .map((p) => p.matriz_article?.trim())
        .filter((m): m is string => !!m),
    ),
    contratos: new Set(
      ((contratos.data ?? []) as Array<{ pf_contract_no: string | null }>)
        .map((c) => c.pf_contract_no?.trim())
        .filter((c): c is string => !!c),
    ),
  };
}

export async function preverImport(
  linhas: LinhaRecibo[],
): Promise<ActionResult & { plano?: PlanoDeImportacao }> {
  try {
    const { supabase } = await requireAdmin();
    const estado = await lerEstado(supabase);
    return { ok: true, plano: construirPlano(linhas, estado) };
  } catch (e) {
    return fail(e);
  }
}

export interface ResultadoImport {
  recibosInseridos: number;
  pagamentosInseridos: number;
  divergenciasIgnoradas: number;
  semFracao: number;
}

export async function aplicarImport(input: {
  landlord_id: string;
  linhas: LinhaRecibo[];
}): Promise<ActionResult & { resultado?: ResultadoImport }> {
  try {
    const { supabase } = await requireAdmin();
    if (!input.landlord_id) return { ok: false, error: "Escolhe o senhorio." };

    const estado = await lerEstado(supabase);
    const plano = construirPlano(input.linhas, estado);
    if (plano.novos.length === 0) {
      return { ok: true, info: "Nada a importar: todos os recibos já existem." };
    }

    // Resolver fração e contrato pelas chaves que já existem. O que não casar entra com
    // `null` — a app já sabe contar recibos órfãos (`cobertura.recibosOrfaos`) e prefere
    // isso a inventar uma fração.
    const [propsQ, contratosQ] = await Promise.all([
      supabase.from("properties").select("id,matriz_article"),
      supabase.from("contracts").select("id,pf_contract_no"),
    ]);
    const fracaoPorMatriz = new Map<string, string>();
    for (const p of (propsQ.data ?? []) as Array<{ id: string; matriz_article: string | null }>) {
      if (p.matriz_article?.trim()) fracaoPorMatriz.set(p.matriz_article.trim(), p.id);
    }
    const contratoPorPfno = new Map<string, string>();
    for (const c of (contratosQ.data ?? []) as Array<{ id: string; pf_contract_no: string | null }>) {
      if (c.pf_contract_no?.trim()) contratoPorPfno.set(c.pf_contract_no.trim(), c.id);
    }

    let semFracao = 0;
    const linhasRecibo = plano.novos.map((r) => {
      const property_id = fracaoPorMatriz.get(r.matriz) ?? null;
      if (!property_id) semFracao += 1;
      return {
        landlord_id: input.landlord_id,
        property_id,
        contract_id: contratoPorPfno.get(r.pf_contract_no) ?? null,
        pf_contract_no: r.pf_contract_no,
        receipt_number: r.receipt_number,
        ref_month: r.ref_month,
        period_start: r.period_start,
        period_end: r.period_end,
        amount: r.amount,
        withholding: r.withholding,
        issue_date: r.issue_date,
        source: "portal" as const,
      };
    });

    // `ignoreDuplicates` e não `merge`: se entretanto alguém escreveu o mesmo recibo, a
    // linha que lá está fica. Um import nunca sobrepõe o que já existe.
    let recibosInseridos = 0;
    for (let i = 0; i < linhasRecibo.length; i += 500) {
      const bloco = linhasRecibo.slice(i, i + 500);
      const { data, error } = await supabase
        .from("receipts")
        .upsert(bloco, { onConflict: "receipt_number", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      recibosInseridos += data?.length ?? 0;
    }

    // Pagamentos: o LÍQUIDO (amount − withholding) somado por contrato-mês, e só onde
    // ainda não há pagamento nenhum. `payments` tem unique(contract_id, ref_month), por
    // isso `ignoreDuplicates` preserva o que foi marcado à mão.
    const porContratoMes = new Map<string, { contract_id: string; ref_month: string; amount: number; received_date: string | null }>();
    for (const r of plano.novos) {
      const contract_id = contratoPorPfno.get(r.pf_contract_no);
      if (!contract_id) continue;
      const chave = `${contract_id}:${r.ref_month}`;
      const atual = porContratoMes.get(chave);
      const liquido = Math.round((r.amount - r.withholding) * 100) / 100;
      if (!atual) {
        porContratoMes.set(chave, {
          contract_id,
          ref_month: r.ref_month,
          amount: liquido,
          received_date: r.issue_date,
        });
      } else {
        atual.amount = Math.round((atual.amount + liquido) * 100) / 100;
        if (r.issue_date && (!atual.received_date || r.issue_date > atual.received_date)) {
          atual.received_date = r.issue_date;
        }
      }
    }

    let pagamentosInseridos = 0;
    const pagamentos = Array.from(porContratoMes.values()).map((p) => ({
      ...p,
      method: "transferencia" as const,
      source: "recibo" as const,
    }));
    for (let i = 0; i < pagamentos.length; i += 500) {
      const bloco = pagamentos.slice(i, i + 500);
      const { data, error } = await supabase
        .from("payments")
        .upsert(bloco, { onConflict: "contract_id,ref_month", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      pagamentosInseridos += data?.length ?? 0;
    }

    revalidatePath("/", "layout");
    return {
      ok: true,
      info: `${recibosInseridos} recibos e ${pagamentosInseridos} pagamentos inseridos.`,
      resultado: {
        recibosInseridos,
        pagamentosInseridos,
        divergenciasIgnoradas: plano.divergencias.length,
        semFracao,
      },
    };
  } catch (e) {
    return fail(e);
  }
}
