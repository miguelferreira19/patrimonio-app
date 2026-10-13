import { getSession } from "@/lib/data";
export async function GET(request: Request) {
  const { user, supabase } = await getSession(); if (!user) return Response.json({ error: "Sessão expirada" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("imovel"); if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return Response.json({ error: "Imóvel inválido" }, { status: 400 });
  const { data, error } = await supabase.from("properties").select("id,matriz_article").eq("id", id).single();
  if (error || !data) return Response.json({ error: "Imóvel não encontrado" }, { status: 404 });
  return Response.json({ scope: data.matriz_article || data.id }, { headers: { "Cache-Control": "no-store" } });
}
