import { getSession } from "@/lib/data";
import { currentMonthKey } from "@/lib/format";
import type { Expense, Landlord, Property } from "@/lib/types";
import { ExpensesClient } from "./expenses-client";

export const dynamic = "force-dynamic";

export default async function DespesasPage() {
  const { supabase, isAdmin } = await getSession();
  const year = parseInt(currentMonthKey().slice(0, 4), 10);
  const since = `${year - 2}-01-01`;

  const [expensesQ, propsQ, landlordsQ] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", since)
      .order("expense_date", { ascending: false }),
    supabase.from("properties").select("id,name").order("name"),
    supabase.from("landlords").select("id,name"),
  ]);

  const expenses = (expensesQ.data ?? []) as Expense[];
  const properties = (propsQ.data ?? []) as Array<Pick<Property, "id" | "name">>;
  const landlords = (landlordsQ.data ?? []) as Array<Pick<Landlord, "id" | "name">>;

  return (
    <ExpensesClient
      expenses={expenses}
      properties={properties}
      landlords={landlords}
      isAdmin={isAdmin}
      currentYear={year}
    />
  );
}
