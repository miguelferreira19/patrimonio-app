import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../env";

/**
 * Cliente com a service-role key — ignora RLS. Só para código sem sessão de utilizador
 * (cron jobs), nunca no browser nem em código alcançável por um pedido normal do site.
 * SUPABASE_SERVICE_ROLE_KEY vive só como env var no Vercel (Production), nunca no repo.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
