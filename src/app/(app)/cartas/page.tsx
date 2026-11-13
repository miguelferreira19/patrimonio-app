import { Lede } from "@/components/kit";
import { ListaCobranca, ListaRendaContrato } from "@/components/cartas/listas";
import { getSession } from "@/lib/data";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { carregarFontesDoDiario } from "@/lib/portfolio/diario-load";
import { diarioDoInquilino } from "@/lib/portfolio/diario";

export const dynamic = "force-dynamic";

export default async function CartasPage() {
  const [{ supabase }, { snap, raw }] = await Promise.all([getSession(), getSnapshotComRaw()]);
  const fontes = await carregarFontesDoDiario(supabase);
  const diario = diarioDoInquilino(raw.contracts.map((c) => c.id), fontes);
  return <div className="mx-auto w-full max-w-2xl space-y-6 tabular-nums">
    <Lede title="Cartas" />
    <ListaCobranca snap={snap} diario={diario} />
    <ListaRendaContrato snap={snap} temCoeficiente={raw.coefficients.length > 0} />
  </div>;
}
