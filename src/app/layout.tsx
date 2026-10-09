import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { RegistarServiceWorker } from "@/components/pwa";

// V4 (REDESENHO.md §5.3): uma só família para tudo, a Inter, com pesos 400/500/600 e
// números tabulares. A Geist Mono fica só para códigos (artigos matriciais, NIF, recibos).
// A Newsreader saiu: dava à app a voz de jornal que a família não queria.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Património · Gestão de arrendamentos",
  description: "Gestão do património familiar: rendas, pagamentos, despesas e mercado.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Património" },
};

// "light dark" ativa o tema escuro automático (segue o SO/browser, sem seletor manual
// na app — P3-3 é sempre "light dark", nunca "só light" nem toggle próprio) e ajusta
// a cor de fundo do status bar/splash do PWA nos dois modos.
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    // V2: as cores do papel (--color-papel), não mais o zinc-50/950.
    { media: "(prefers-color-scheme: light)", color: "#f3f5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1213" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body
        className={`${inter.variable} ${geistMono.variable} min-h-screen font-sans`}
      >
        {children}
        <RegistarServiceWorker />
      </body>
    </html>
  );
}
