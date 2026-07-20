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
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Procurar por morada, freguesia, inquilino…"
          className="w-full sm:max-w-xs"
        />
        <Select
          value={landlord}
          onChange={(e) => setLandlord(e.target.value)}
          className="w-full sm:w-auto sm:max-w-44"
        >
          <option value="">Todos os senhorios</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full sm:w-auto sm:max-w-36"
        >
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
        <>
          {/* Desktop/tablet: tabela com cabeçalho fixo ao fazer scroll vertical. */}
          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th className="sticky top-0 z-10 bg-white">Fração</Th>
                  <Th className="sticky top-0 z-10 bg-white">Freguesia</Th>
                  <Th className="sticky top-0 z-10 bg-white">Tipol.</Th>
                  <Th className="sticky top-0 z-10 bg-white text-right">Área</Th>
                  <Th className="sticky top-0 z-10 bg-white">Senhorios</Th>
                  <Th className="sticky top-0 z-10 bg-white">Inquilino</Th>
                  <Th className="sticky top-0 z-10 bg-white text-right">Renda</Th>
                  <Th className="sticky top-0 z-10 bg-white text-right">€/m²</Th>
                  <Th className="sticky top-0 z-10 bg-white">Vs. mercado</Th>
                  <Th className="sticky top-0 z-10 bg-white">Estado</Th>
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
          </div>

          {/* Mobile: um cartão por fração, com todos os dados da linha. */}
          <div className="space-y-2 md:hidden">
            {filtered.map((r) => (
              <div key={r.property.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/fracoes/${r.property.id}`}
                    className="font-medium text-teal-700 hover:underline"
                  >
                    {r.property.name}
                  </Link>
                  {r.property.status === "arrendado" ? (
                    <Badge tone="green">Arrendado</Badge>
                  ) : r.property.status === "vago" ? (
                    <Badge tone="amber">Vago</Badge>
                  ) : (
                    <Badge tone="zinc">Outro</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {r.property.parish ?? "n/d"}
                  {r.property.typology && ` · ${r.property.typology}`}
                  {r.property.area_m2 ? ` · ${fmtNum(r.property.area_m2, 0)} m²` : ""}
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <div>
                    <p className="text-[11px] text-zinc-400">Senhorios</p>
                    <p className="truncate text-zinc-700">{r.ownersLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-400">Inquilino</p>
                    <p className="truncate text-zinc-700">{r.tenant ?? "n/d"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-400">Renda</p>
                    <p className="tabular-nums font-medium text-zinc-800">{fmtEur(r.rent)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-400">€/m² vs. mercado</p>
                    <div className="flex items-center gap-1.5">
                      <span className="tabular-nums text-zinc-700">
                        {r.rentPerM2 !== null ? fmtNum(r.rentPerM2, 1) : "n/d"}
                      </span>
                      <DeviationBadge deviation={r.deviation} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
