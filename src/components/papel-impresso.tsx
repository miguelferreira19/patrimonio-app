import type { ReactNode } from "react";
import { PrintButton } from "./print-button";

// A FOLHA A4. Sem hooks, logo sem "use client" (mesma regra do ui.tsx e do kit/).
//
// Nasceu a dobrar: a carta de atualização de renda já tinha estas regras de impressão e as
// minutas precisavam exatamente das mesmas. Em vez de as copiar, ficam num sítio só.
//
// As regras `@media print` escondem a navegação da app. `body > div > header` isola o
// masthead (filho direto do wrapper do layout) dos <header> internos dos Card, que vivem
// bem dentro de <main> e nunca são filhos diretos de body > div. O `aside` cobre o rail do
// nav.tsx, que continua no repo como caminho de volta.
function EstilosDeImpressao() {
  return (
    <style>{`
      @media print {
        aside, body > div > header { display: none !important; }
        main { margin: 0 !important; max-width: none !important; padding: 0 !important; }
      }
    `}</style>
  );
}

export function PapelImpresso({
  migalhas,
  children,
}: {
  /** A linha de navegação por cima da folha. Não é impressa. */
  migalhas: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <EstilosDeImpressao />
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs text-tinta-3">{migalhas}</p>
        <PrintButton />
      </div>
      <div className="mx-auto max-w-[210mm] rounded-lg border border-regua bg-white p-10 text-sm text-zinc-800 shadow-xs print:max-w-none print:rounded-none print:border-none print:p-0 print:shadow-none">
        {children}
      </div>
    </div>
  );
}

/** Linhas de assinatura no fim da folha. Uma por interveniente. */
export function Assinaturas({ legendas }: { legendas: string[] }) {
  return (
    <div className="mt-16 space-y-10">
      {legendas.map((l) => (
        <div key={l}>
          <div className="h-px w-64 bg-zinc-400" />
          <p className="mt-1.5 text-xs text-zinc-500">{l}</p>
        </div>
      ))}
    </div>
  );
}
