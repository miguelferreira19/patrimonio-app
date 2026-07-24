"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/** Único bit de JS de cliente desta feature: aciona o diálogo de impressão do
 *  browser (Ctrl+P faz o mesmo). Escondido em @media print pela própria page.tsx. */
export function PrintButton() {
  return (
    <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
      <Printer size={14} />
      Imprimir
    </Button>
  );
}
