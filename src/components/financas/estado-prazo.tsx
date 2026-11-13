"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { dismissInsight, restoreInsight } from "@/lib/actions/insights";

export default function EstadoPrazo({ id, feito }: { id: string; feito: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  function alterar() {
    setErro("");
    iniciar(async () => {
      try {
        const input = { kind: "prazo", subject: id };
        const resultado = await (feito ? restoreInsight(input) : dismissInsight(input));
        if (!resultado.ok) setErro(resultado.error);
      } catch {
        setErro("Não foi possível guardar. Tenta novamente.");
      }
    });
  }
  return <div>
    <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={pendente}
      onClick={alterar}>{pendente ? "A guardar" : feito ? "Desfazer" : "Feito"}</Button>
    {erro && <p role="alert" className="mt-2 text-sm text-perda">{erro}</p>}
  </div>;
}
