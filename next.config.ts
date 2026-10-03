import type { NextConfig } from "next";
import { SUPABASE_URL } from "./src/lib/env";

// Cabeçalhos de segurança (2026-10-03). Até aqui não havia nenhum: a app mostra NIFs,
// moradas e rendas de inquilinos e podia ser embebida num iframe alheio (clickjacking).
//
// O browser só fala com a própria app e com o Supabase (auth, Storage do arquivo). O INE
// e o Portal das Finanças são lidos no servidor ou abertos como links, e por isso não
// entram aqui.
//
// ponytail: `script-src 'unsafe-inline'` e não um nonce por pedido. O Next precisa de
// scripts inline para hidratar; com nonce, o middleware teria de o gerar e todas as
// páginas o propagar. As páginas são todas dinâmicas e o React escapa o que desenha, por
// isso o ganho seria pequeno para a complexidade. Se um dia entrar HTML de terceiros na
// app, o upgrade é o nonce (docs do Next: "Content Security Policy").
const dev = process.env.NODE_ENV === "development";
const supabase = new URL(SUPABASE_URL);

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${supabase.origin} wss://${supabase.host}${dev ? " ws:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
