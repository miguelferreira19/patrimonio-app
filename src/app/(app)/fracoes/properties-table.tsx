"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Card, EmptyState, Input, Select, Table, Td, Th } from "@/components/ui";
import { fmtEur, fmtNum, fmtPct } from "@/lib/format";
import type { Landlord, Property } from "@/lib/types";

export interface PropertyRowVM {
  property: Property;
  ownerIds: string[];
  ownersLabel: string;
  tenant: string | null;
  rent: number | null;
  rentPerM2: number | null;
  deviation: number | null;
}

// Componente (não função-utilitária) de propósito: exportado de um ficheiro "use client",
// só é seguro invocar como JSX (<DeviationBadge />) a partir de Server Components — chamá-lo
// como função normal falha em runtime ("client function called from server").
export function DeviationBadge({ deviation: dev }: { deviation: number | null }) {
  if (dev === null) return <Badge tone="zinc">s/ dados</Badge>;
  if (dev <= -0.15) return <Badge tone="red">{fmtPct(dev, 0, true)}</Badge>;
  if (dev < -0.05) return <Badge tone="amber">{fmtPct(dev, 0, true)}</Badge>;
  if (dev <= 0.05) return <Badge tone="green">{fmtPct(dev, 0, true)}</Badge>;
  return <Badge tone="teal">{fmtPct(dev, 0, true)}</Badge>;
}

export function PropertiesTable({
  rows,
  landlords,
}: {
  rows: PropertyRowVM[];
  landlords: Landlord[];
}) {
  const [q, setQ] = useState("");
  const [landlord, setLandlord] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (landlord && !r.ownerIds.includes(landlord)) return false;
      if (status && r.property.status !== status) return false;
      if (needle) {
        const hay = `${r.property.name} ${r.property.address ?? ""} ${r.property.parish ?? ""} ${r.tenant ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, landlord, status]);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Procurar por morada, freguesia, inquilino…"
          className="max-w-xs"
        />
        <Select value={landlord} onChange={(e) => setLandlord(e.target.value)} className="max-w-44">
          <option value="">Todos os senhorios</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-36">
          <option value="">Todos os estados</option>
          <option value="arrendado">Arrendado</option>
          <option value="vago">Vago</option>
          <option value="outro">Outro</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2}>
          Sem frações. Usa &quot;Nova fração&quot; ou o import do Portal das Finanças (Admin).
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Fração</Th>
              <Th>Freguesia</Th>
              <Th>Tipol.</Th>
              <Th className="text-right">Área</Th>
              <Th>Senhorios</Th>
              <Th>Inquilino</Th>
              <Th className="text-right">Renda</Th>
              <Th className="text-right">€/m²</Th>
              <Th>Vs. mercado</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.property.id} className="hover:bg-zinc-50">
                <Td>
                  <Link
                    href={`/fracoes/${r.property.id}`}
                    className="font-medium text-teal-700 hover:underline"
                  >
                    {r.property.name}
                  </Link>
                </Td>
                <Td>{r.property.parish ?? "n/d"}</Td>
                <Td>{r.property.typology ?? "n/d"}</Td>
                <Td className="text-right tabular-nums">
                  {r.property.area_m2 ? `${fmtNum(r.property.area_m2, 0)} m²` : "n/d"}
                </Td>
                <Td className="max-w-40 truncate">{r.ownersLabel}</Td>
                <Td className="max-w-40 truncate">{r.tenant ?? "n/d"}</Td>
                <Td className="text-right tabular-nums">{fmtEur(r.rent)}</Td>
                <Td className="text-right tabular-nums">
                  {r.rentPerM2 !== null ? fmtNum(r.rentPerM2, 1) : "n/d"}
                </Td>
                <Td><DeviationBadge deviation={r.deviation} /></Td>
                <Td>
                  {r.property.status === "arrendado" ? (
                    <Badge tone="green">Arrendado</Badge>
                  ) : r.property.status === "vago" ? (
                    <Badge tone="amber">Vago</Badge>
                  ) : (
                    <Badge tone="zinc">Outro</Badge>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
