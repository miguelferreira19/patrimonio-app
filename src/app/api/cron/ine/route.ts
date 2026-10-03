// Refresh trimestral automático dos benchmarks INE (PLANO.md P1-4). Vercel Cron chama isto
// com o header Authorization: Bearer <CRON_SECRET> (config em vercel.json); qualquer outro
// pedido é rejeitado. Usa a service-role key (ignora RLS) porque não há sessão de utilizador.
import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { runIneRefresh } from "@/lib/ine-refresh";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Falha FECHADA (2026-10-03). A comparação era com o template "Bearer ${CRON_SECRET}", e com a variável
 *  em falta (é o caso dos deploys de Preview) o header literal `Bearer undefined` passava,
 *  numa rota que escreve com a service-role key. A comparação é em tempo constante para o
 *  segredo não se adivinhar carácter a carácter pela latência. */
function autorizado(auth: string | null): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || !auth) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(auth);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function GET(request: NextRequest) {
  if (!autorizado(request.headers.get("authorization"))) {
    return new Response("Não autorizado.", { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { info } = await runIneRefresh(supabase);
    return Response.json({ ok: true, info });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
