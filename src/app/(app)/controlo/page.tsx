import { redirect } from "next/navigation";
import { getSession } from "@/lib/data";
import { pode } from "@/lib/papeis";
import { carregarObservacoes } from "@/lib/controlo-load";
import { EmptyState } from "@/components/ui";
import { carregarControlo } from "@/components/controlo/carregar";
import Painel from "@/components/controlo/painel";

export const dynamic = "force-dynamic";

export default async function Controlo({ searchParams }: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { supabase, role, isAdmin } = await getSession();
  if (!isAdmin || !pode(role, "ver_controlo")) redirect("/");
  const resultado = await carregarObservacoes(supabase);
  if (resultado.tabelaEmFalta) return <EmptyState>
    O controlo começa a funcionar depois de aplicar a migração e da primeira recolha.
  </EmptyState>;
  const [dados, sp] = await Promise.all([carregarControlo(supabase, resultado.observacoes), searchParams]);
  return <Painel dados={dados} ver={sp.ver} />;
}
