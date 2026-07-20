import { getSession } from "@/lib/data";
import { lastMonthsKeys } from "@/lib/format";
import type { Contract, Landlord, Payment, Property, PropertyOwner } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { PaymentsGrid } from "./payments-grid";

export const dynamic = "force-dynamic";

export default async function PagamentosPage() {
  const { supabase, isAdmin } = await getSession();
  const months = lastMonthsKeys(12);

  const [contractsQ, propsQ, ownersQ, landlordsQ, paymentsQ] = await Promise.all([
    supabase.from("contracts").select("*"),
    supabase.from("properties").select("id,name"),
    supabase.from("property_owners").select("*"),
    supabase.from("landlords").select("*").order("name"),
    supabase.from("payments").select("*").gte("ref_month", months[0]),
  ]);

  const contracts = (contractsQ.data ?? []) as Contract[];
  const properties = (propsQ.data ?? []) as Array<Pick<Property, "id" | "name">>;
  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const landlords = (landlordsQ.data ?? []) as Landlord[];
  const payments = (paymentsQ.data ?? []) as Payment[];

  const propertyById = new Map(properties.map((p) => [p.id, p.name]));
  const ownersByProperty = new Map<string, string[]>();
  for (const o of owners) {
    const list = ownersByProperty.get(o.property_id) ?? [];
    list.push(o.landlord_id);
    ownersByProperty.set(o.property_id, list);
  }

  const rows = contracts
    .map((c) => ({
      contract: c,
      propertyName: propertyById.get(c.property_id) ?? "?",
      ownerIds: ownersByProperty.get(c.property_id) ?? [],
    }))
    .sort((a, b) => a.propertyName.localeCompare(b.propertyName, "pt"));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pagamentos"
        description={
          <>
            Grelha dos últimos 12 meses.{" "}
            {isAdmin
              ? "Clica numa célula para marcar a renda como recebida (transferência ou dinheiro)."
              : "Acesso de leitura."}
          </>
        }
      />
      <PaymentsGrid
        rows={rows}
        months={months}
        payments={payments}
        landlords={landlords}
        isAdmin={isAdmin}
      />
    </div>
  );
}
