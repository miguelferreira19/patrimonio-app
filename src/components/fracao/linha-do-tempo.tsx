import { Faixa } from "@/components/faixa/faixa";
import type { MonthCellData } from "@/lib/monthcell";

export function LinhaDoTempo({ ano, meses, total, contractId }: {
  ano: number; meses: MonthCellData[]; total: number; contractId: string;
}) {
  return <Faixa meses={meses.map((m) => m.month)} linhas={[{
    id: contractId, contractId, nome: String(ano), sub: "Registos do ano",
    href: `/rendas/${contractId}`, estado: "arrendado", celulas: meses, valor: total, nota: "líquido registado",
  }]} horizon={meses.filter((m) => m.status !== "futuro" && m.status !== "fora").at(-1)?.month ?? null} carteira={[]} />;
}
