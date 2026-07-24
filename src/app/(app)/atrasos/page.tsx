import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { computeArrears, type ArrearsContractInput, type ArrearsPaymentInput } from "@/lib/arrears";
import { isCurrentProperty } from "@/lib/calc";
import { fetchAllPayments, getSession } from "@/lib/data";
import { fmtEur } from "@/lib/format";
import type { Landlord, Property, PropertyOwner } from "@/lib/types";
import { ArrearsClient, type ArrearsViewRow } from "./arrears-client";

export const dynamic = "force-dynamic";

type ArrearsPropertyRow = Pick<Property, "id" | "name" | "matriz_article" | "status">;
type ArrearsLandlordRow = Pick<Landlord, "id" | "name">;

export default async function AtrasosPage() {
  const { supabase } = await getSession();

  const [contractsQ, propsQ, ownersQ, landlordsQ, allPayments] = await Promise.all([
    supabase
      .from("contracts")
      .select("id,rent,start_date,property_id,tenant_name,pf_contract_no")
      .eq("status", "ativo"),
    supabase.from("properties").select("id,name,matriz_article,status"),
    supabase.from("property_owners").select("*"),
    supabase.from("landlords").select("id,name").order("name"),
    // Histórico COMPLETO de pagamentos (o último mês pago pode ser há anos). Paginado: o
    // Supabase corta a resposta a ~1000 linhas mesmo com .limit() alto, e a tabela tem >5000
    // — sem paginar, contratos inteiros ficavam sem pagamentos e apareciam como "nunca".
    fetchAllPayments(supabase),
  ]);

  const allContracts = (contractsQ.data ?? []) as ArrearsContractInput[];
  const properties = (propsQ.data ?? []) as ArrearsPropertyRow[];
  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const landlords = (landlordsQ.data ?? []) as ArrearsLandlordRow[];
  const payments = allPayments as ArrearsPaymentInput[];

  // P0-2c: terrenos nunca tiveram renda e imóveis vendidos já não são da família —
  // os contratos ligados a essas frações não podem gerar dívida corrente (ex.:
  // 182341-U-4364, vendido pelo avô, cuja dívida ficou saldada na venda).
  const currentPropertyIds = new Set(properties.filter(isCurrentProperty).map((p) => p.id));
  const contracts = allContracts.filter((c) => currentPropertyIds.has(c.property_id));

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
      <PageHeader
        eyebrow="Cobrança"
        title="Rendas em atraso"
        description={description}
        actions={
          <Link
            href="/pagamentos"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-teal-800 px-3.5 text-sm font-medium text-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)] transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            <Plus size={15} strokeWidth={2} />
            Registar pagamento
          </Link>
        }
      />
      <ArrearsClient rows={viewRows} landlords={landlords} summary={summary} />
    </div>
  );
}
