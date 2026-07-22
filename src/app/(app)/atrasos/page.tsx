import { PageHeader } from "@/components/ui";
import { computeArrears, type ArrearsContractInput, type ArrearsPaymentInput } from "@/lib/arrears";
import { fetchAllPayments, getSession } from "@/lib/data";
import { fmtEur } from "@/lib/format";
import type { Landlord, Property, PropertyOwner } from "@/lib/types";
import { ArrearsClient, type ArrearsViewRow } from "./arrears-client";

export const dynamic = "force-dynamic";

type ArrearsPropertyRow = Pick<Property, "id" | "name" | "matriz_article">;
type ArrearsLandlordRow = Pick<Landlord, "id" | "name">;

export default async function AtrasosPage() {
  const { supabase } = await getSession();

  const [contractsQ, propsQ, ownersQ, landlordsQ, allPayments] = await Promise.all([
    supabase
      .from("contracts")
      .select("id,rent,start_date,property_id,tenant_name,pf_contract_no")
      .eq("status", "ativo"),
    supabase.from("properties").select("id,name,matriz_article"),
    supabase.from("property_owners").select("*"),
    supabase.from("landlords").select("id,name").order("name"),
    // Histórico COMPLETO de pagamentos (o último mês pago pode ser há anos). Paginado: o
    // Supabase corta a resposta a ~1000 linhas mesmo com .limit() alto, e a tabela tem >5000
    // — sem paginar, contratos inteiros ficavam sem pagamentos e apareciam como "nunca".
    fetchAllPayments(supabase),
  ]);

  const contracts = (contractsQ.data ?? []) as ArrearsContractInput[];
  const properties = (propsQ.data ?? []) as ArrearsPropertyRow[];
  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const landlords = (landlordsQ.data ?? []) as ArrearsLandlordRow[];
  const payments = allPayments as ArrearsPaymentInput[];

  const { rows, summary } = computeArrears(contracts, payments, new Date());

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const landlordById = new Map(landlords.map((l) => [l.id, l]));
  const ownersByProperty = new Map<string, string[]>();
  for (const o of owners) {
    const list = ownersByProperty.get(o.property_id) ?? [];
    list.push(o.landlord_id);
    ownersByProperty.set(o.property_id, list);
  }

  const viewRows: ArrearsViewRow[] = rows.map((r) => {
    const property = propertyById.get(r.propertyId);
    const landlordIds = ownersByProperty.get(r.propertyId) ?? [];
    const landlordNames = landlordIds.map((id) => landlordById.get(id)?.name ?? "?");
    return {
      ...r,
      propertyName: property?.name ?? "?",
      matrizArticle: property?.matriz_article ?? null,
      landlordIds,
      landlordNames,
    };
  });

  const description =
    summary.contractsInArrears > 0
      ? `${summary.contractsInArrears} contrato${summary.contractsInArrears === 1 ? "" : "s"} em atraso · ${fmtEur(summary.rentAtRisk)} de renda mensal em risco.`
      : "Nenhum contrato ativo tem rendas em atraso neste momento.";

  return (
    <div className="space-y-4">
      <PageHeader title="Atrasos" description={description} />
      <ArrearsClient rows={viewRows} landlords={landlords} summary={summary} />
    </div>
  );
}
