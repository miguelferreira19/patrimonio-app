// ponytail: fallback aos valores reais do Supabase deste projeto — a anon key é pública
// por design (RLS é quem protege os dados, já ativo). .env.local continua a ter prioridade
// em dev; isto só evita ter de configurar env vars manualmente no Vercel para este deploy.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iidvzcgtfbpzhjbsrqql.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpZHZ6Y2d0ZmJwemhqYnNycXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MzQwMTMsImV4cCI6MjEwMDAxMDAxM30.poiCq8515P12V-JTxinENVTlnufApmfIoDXJbtRf8Og";
