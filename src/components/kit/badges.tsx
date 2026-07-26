// Os dois badges que sobreviveram à tabela de Frações, quando ela foi absorvida pela
// Faixa. Vivem aqui porque a ficha da fração e o Mercado continuam a usá-los e não
// devem depender de um ficheiro de página.
//
// Sem hooks, logo sem "use client" — mesma regra do ui.tsx e do resto do kit.

import { Badge } from "@/components/ui";
import { fmtPct } from "@/lib/format";
import type { Property } from "@/lib/types";

export function DeviationBadge({ deviation: dev }: { deviation: number | null }) {
  if (dev === null) return <Badge tone="zinc">s/ dados</Badge>;
  if (dev <= -0.15) return <Badge tone="red">{fmtPct(dev, 0, true)}</Badge>;
  if (dev < -0.05) return <Badge tone="amber">{fmtPct(dev, 0, true)}</Badge>;
  if (dev <= 0.05) return <Badge tone="green">{fmtPct(dev, 0, true)}</Badge>;
  return <Badge tone="teal">{fmtPct(dev, 0, true)}</Badge>;
}

// P0-2c: terreno e vendido têm tom neutro (zinc) de propósito — não são um estado
// "mau" como vago, só não contam para as métricas correntes (ver isCurrentProperty).
export function PropertyStatusBadge({ status }: { status: Property["status"] }) {
  if (status === "arrendado") return <Badge tone="green">Arrendado</Badge>;
  if (status === "vago") return <Badge tone="amber">Vago</Badge>;
  if (status === "terreno") return <Badge tone="zinc">Terreno</Badge>;
  if (status === "vendido") return <Badge tone="zinc">Vendido</Badge>;
  return <Badge tone="zinc">Outro</Badge>;
}
