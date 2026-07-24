import { geoOptionsFromBenchmarks, isCurrentProperty, marketView } from "@/lib/calc";
import { getSession } from "@/lib/data";
import type {
  Contract,
  Landlord,
  MarketBenchmark,
  Property,
  PropertyOwner,
} from "@/lib/types";
import { Building2, DoorOpen, KeyRound, Ruler } from "lucide-react";
import { PropertyFormButton } from "@/components/forms";
import { PageHeader, StatCard } from "@/components/ui";
import { fmtNum, fmtPct } from "@/lib/format";
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

  // P0-2c: os KPIs do hero são "métricas correntes" — terrenos e imóveis vendidos ficam
  // de fora (não contam para ocupação nem para €/m² médio). A tabela abaixo continua a
  // listar TODAS as frações, incluindo estas (é o histórico legítimo).
  const currentRows = rows.filter((r) => isCurrentProperty(r.property));
  const rented = currentRows.filter((r) => r.rent !== null).length;
  const occupancy = currentRows.length > 0 ? rented / currentRows.length : 0;

  // €/m² médio: só as frações com área preenchida entram (o resto ainda está por completar,
  // ver P0-2) — daí o `sub` dizer sobre quantas é que a média foi calculada.
  const withM2 = currentRows.filter((r) => r.rentPerM2 !== null);
  const avgPerM2 =
    withM2.length > 0 ? withM2.reduce((a, r) => a + (r.rentPerM2 ?? 0), 0) / withM2.length : null;
  const deviations = currentRows.filter((r) => r.deviation !== null);
  const avgDeviation =
    deviations.length > 0
      ? deviations.reduce((a, r) => a + (r.deviation ?? 0), 0) / deviations.length
      : null;

  const description =
    `${currentRows.length} frações, ${rented} arrendadas (${fmtPct(occupancy, 0)} de ocupação).` +
    (avgDeviation !== null
      ? ` As rendas estão ${fmtPct(Math.abs(avgDeviation), 0)} ${avgDeviation < 0 ? "abaixo" : "acima"} da mediana do mercado.`
      : " Falta preencher áreas e freguesias para comparar com o mercado.");

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Portefólio"
        title="Frações"
        description={description}
        actions={isAdmin && <PropertyFormButton landlords={landlords} geoOptions={geoOptions} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total de frações" value={currentRows.length} icon={Building2} />
        <StatCard
          label="Arrendadas"
          value={rented}
          sub={`${currentRows.length - rented} sem contrato ativo`}
          tone="teal"
          icon={KeyRound}
        />
        <StatCard
          label="Ocupação"
          value={fmtPct(occupancy, 0)}
          tone={occupancy >= 1 ? "green" : "zinc"}
          icon={DoorOpen}
        />
        <StatCard
          label="Renda média por m²"
          value={avgPerM2 !== null ? `${fmtNum(avgPerM2, 2)} €` : "·"}
          sub={
            avgPerM2 !== null
              ? `sobre ${withM2.length} de ${currentRows.length} frações com área`
              : "sem áreas preenchidas"
          }
          tone="amber"
          icon={Ruler}
        />
      </div>

      <PropertiesTable rows={rows} landlords={landlords} />
    </div>
  );
}
