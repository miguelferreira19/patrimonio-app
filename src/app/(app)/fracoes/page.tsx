import { geoOptionsFromBenchmarks, marketView } from "@/lib/calc";
import { getSession } from "@/lib/data";
import type {
  Contract,
  Landlord,
  MarketBenchmark,
  Property,
  PropertyOwner,
} from "@/lib/types";
import { PropertyFormButton } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { PropertiesTable, type PropertyRowVM } from "./properties-table";

export const dynamic = "force-dynamic";

export default async function FracoesPage() {
  const { supabase, isAdmin } = await getSession();

  const [propsQ, ownersQ, landlordsQ, contractsQ, benchQ] = await Promise.all([
    supabase.from("properties").select("*").order("name"),
    supabase.from("property_owners").select("*"),
    supabase.from("landlords").select("*").order("name"),
    supabase.from("contracts").select("*"),
    supabase.from("market_benchmarks").select("*"),
  ]);

  const properties = (propsQ.data ?? []) as Property[];
  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const landlords = (landlordsQ.data ?? []) as Landlord[];
  const contracts = (contractsQ.data ?? []) as Contract[];
  const benchmarks = (benchQ.data ?? []) as MarketBenchmark[];
  const geoOptions = geoOptionsFromBenchmarks(benchmarks);

  const landlordById = new Map(landlords.map((l) => [l.id, l]));

  const rows: PropertyRowVM[] = properties.map((p) => {
    const pOwners = owners.filter((o) => o.property_id === p.id);
    const active = contracts.find((c) => c.property_id === p.id && c.status === "ativo");
    const mv = marketView(p, active, benchmarks);
    return {
      property: p,
      ownerIds: pOwners.map((o) => o.landlord_id),
      ownersLabel:
        pOwners
          .map((o) => landlordById.get(o.landlord_id)?.name)
          .filter(Boolean)
          .join(" + ") || "sem senhorio",
      tenant: active?.tenant_name ?? null,
      rent: active?.rent ?? null,
      rentPerM2: mv.rentPerM2,
      deviation: mv.deviation,
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Frações"
        description={`${properties.length} frações · ${rows.filter((r) => r.rent !== null).length} arrendadas`}
        actions={isAdmin && <PropertyFormButton landlords={landlords} geoOptions={geoOptions} />}
      />
      <PropertiesTable rows={rows} landlords={landlords} />
    </div>
  );
}
