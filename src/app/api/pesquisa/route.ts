// O índice da pesquisa global (V4 F7). Um pedido por abertura da pesquisa: a filtragem é
// feita no browser com a mesma função pura (`procurar`), sem ir à BD por cada tecla.
// Usa o snapshot LEVE (sem o histórico de pagamentos), que é tudo o que o índice precisa.
import { lerArquivo } from "@/components/documentos/lista";
import { getSession } from "@/lib/data";
import { getSnapshotLeve } from "@/lib/portfolio";
import { construirIndice } from "@/lib/portfolio/pesquisa";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, isAdmin, supabase } = await getSession();
  if (!user) return new Response("Sessão expirada.", { status: 403 });
  const [snap, arquivo] = await Promise.all([getSnapshotLeve(), lerArquivo(supabase)]);
  const docs = arquivo.docs.filter((d) => isAdmin || d.escopo !== "geral");
  return Response.json(construirIndice({ ativos: snap.ativos, docs, isAdmin }), {
    headers: { "Cache-Control": "no-store" },
  });
}
