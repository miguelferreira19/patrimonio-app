import { cache } from "react";
import { getSession } from "../data";
import { paginateAll } from "../paginate";
import { linhas } from "../supabase/dados";
import type { Receipt } from "../types";
import type { ManagementCase, ManagementEvent, OperationHistory, PaymentAllocation, PaymentMovement, PeriodConfirmation } from "../gestao";

type Client = Awaited<ReturnType<typeof getSession>>["supabase"];
async function all<T>(client: Client, table: string, order: string) {
  return paginateAll<T>(async (from, to) => {
    const result = await client.from(table).select("*").order(order).range(from, to);
    return linhas<T>(result, table);
  });
}
export const getManagement = cache(async () => {
  const { supabase, user } = await getSession();
  if (!user) throw new Error("Sessão expirada, volta a entrar.");
  const [cases, events, movements, allocations, confirmations, receiptLinks] = await Promise.all([
    all<ManagementCase>(supabase, "management_cases", "id"),
    all<ManagementEvent>(supabase, "management_events", "id"),
    all<PaymentMovement>(supabase, "payment_movements", "id"),
    paginateAll<PaymentAllocation>(async (from, to) => linhas<PaymentAllocation>(await supabase.from("payment_allocations").select("*").order("movement_id").order("ref_month").range(from, to), "payment_allocations")),
    paginateAll<PeriodConfirmation>(async (from, to) => linhas<PeriodConfirmation>(await supabase.from("period_confirmations").select("*").order("contract_id").order("ref_month").range(from, to), "period_confirmations")),
    paginateAll<{ receipt_id: string; movement_id: string }>(async (from, to) => linhas(await supabase.from("receipt_payment_links").select("receipt_id,movement_id").order("receipt_id").order("movement_id").range(from, to), "receipt_payment_links")),
  ]);
  return { cases, events, movements, allocations, confirmations, receiptLinks };
});
export const getReceiptsInPeriod = cache(async (from: string, to: string): Promise<Receipt[]> => {
  const { supabase, user } = await getSession();
  if (!user) throw new Error("Sessão expirada, volta a entrar.");
  return paginateAll<Receipt>(async (start, end) => linhas<Receipt>(await supabase.from("receipts").select("*").gte("ref_month", from).lte("ref_month", to).order("id").range(start, end), "receipts"));
});
export const getOrphanReceipts = cache(async (): Promise<Receipt[]> => {
  const { supabase, isAdmin } = await getSession();
  if (!isAdmin) throw new Error("Apenas o administrador pode corrigir recibos.");
  return paginateAll<Receipt>(async (start, end) => linhas<Receipt>(await supabase.from("receipts").select("*").is("contract_id", null).order("id").range(start, end), "receipts"));
});
export async function getOperationHistory(table: string, id: string) {
  const { supabase, user } = await getSession();
  if (!user) throw new Error("Sessão expirada, volta a entrar.");
  return paginateAll<OperationHistory>(async (start, end) => linhas<OperationHistory>(await supabase.from("operation_history").select("*").eq("entity_table", table).eq("entity_id", id).order("id", { ascending: false }).range(start, end), "operation_history"));
}
