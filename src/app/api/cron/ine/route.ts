// Refresh trimestral automático dos benchmarks INE (PLANO.md P1-4). Vercel Cron chama isto
// com o header Authorization: Bearer <CRON_SECRET> (config em vercel.json); qualquer outro
// pedido é rejeitado. Usa a service-role key (ignora RLS) porque não há sessão de utilizador.
import { NextRequest } from "next/server";
import { runIneRefresh } from "@/lib/actions/market";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
