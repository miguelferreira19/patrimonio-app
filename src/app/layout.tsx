import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RegistarServiceWorker } from "@/components/pwa";

// Sinal: DM Sans no texto, Bricolage Grotesque nos títulos e números grandes.
// A Geist Mono fica só para códigos (artigos matriciais, NIF, recibos).
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Património · Gestão de arrendamentos",
  description: "Gestão do património familiar: rendas, pagamentos, despesas e mercado.",
  manifest: "/manifest.json",
  icons: { icon: [{ url: "/favicon.ico?v=20261106a", sizes: "16x16 32x32 48x48" }, { url: "/brand/app-icon.svg?v=20261106a", type: "image/svg+xml" }], apple: "/apple-icon.png?v=20261106a" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Património" },
};

// "light dark" ativa o tema escuro automático (segue o SO/browser, sem seletor manual
// na app — P3-3 é sempre "light dark", nunca "só light" nem toggle próprio) e ajusta
// a cor de fundo do status bar/splash do PWA nos dois modos.
export const viewport: Viewport = {
  colorScheme: "light dark",
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1114" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body
        className={`${dmSans.variable} ${bricolage.variable} ${geistMono.variable} min-h-screen font-sans`}
      >
        {children}
        <RegistarServiceWorker />
      </body>
    </html>
  );
}
