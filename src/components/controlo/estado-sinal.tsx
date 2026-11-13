"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { dismissInsight } from "@/lib/actions/insights";

export default function EstadoSinal({ id, estado }: { id: string; estado?: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  function marcar(note: "Visto" | "Justificado") {
    setErro("");
    iniciar(async () => {
      try {
        const r = await dismissInsight({ kind: "controlo", subject: id, note });
        if (!r.ok) setErro(r.error);
      } catch {
        setErro("Não foi possível guardar. Tenta novamente.");
      }
    });
  }
  return <div className="pb-3">
    <div className="flex flex-wrap gap-2">
      {(["Visto", "Justificado"] as const).map((texto) => <Button key={texto} type="button"
        variant="outline" size="sm" className="min-h-11" disabled={pendente || estado === texto}
        onClick={() => marcar(texto)}>{texto}</Button>)}
    </div>
    {erro && <p role="alert" className="mt-2 text-sm text-perda">{erro}</p>}
  </div>;
}
