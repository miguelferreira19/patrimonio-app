import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// V2: uma serifa só para texto que se LÊ (ledes, títulos do Ano, linha de dinheiro).
// Nunca em chrome de UI — é o que separa "documento" de "dashboard". Dois pesos, latin,
// só os caracteres que a app usa em títulos.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal"],
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
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} min-h-screen font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
