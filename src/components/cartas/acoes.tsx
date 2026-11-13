"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { registarNoDiario } from "@/lib/actions/diario";

export function CopiarMensagem({ texto }: { texto: string }) {
  const [mensagem, setMensagem] = useState("");
  return <div className="space-y-2">
    <Button type="button" variant="outline" onClick={async () => {
      try { await navigator.clipboard.writeText(texto); setMensagem("Mensagem copiada"); }
      catch { setMensagem("Não foi possível copiar. Seleciona o texto em Detalhes."); }
    }}>Copiar mensagem</Button>
    {mensagem && <div role="status" className="text-sm text-tinta-2">{mensagem}</div>}
    <details><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Detalhes</summary>
      <p className="select-text text-base text-tinta-2">{texto}</p>
    </details>
  </div>;
}

export function MarcarEnviada({ contractId, tipo, rotulo, hoje }: {
  contractId: string; tipo: string; rotulo: string; hoje: string;
}) {
  const requestId = useRef("");
  const ocupado = useRef(false);
  const [pending, setPending] = useState(false);
  const [resultado, setResultado] = useState("");
  const [guardado, setGuardado] = useState(false);
  const router = useRouter();
  return <form className="space-y-3" onSubmit={async (event) => {
    event.preventDefault();
    if (ocupado.current || guardado) return;
    ocupado.current = true;
    requestId.current ||= crypto.randomUUID();
    const dia = String(new FormData(event.currentTarget).get("dia"));
    setPending(true);
    try {
      const r = await registarNoDiario({ contractId, kind: "carta", note: `${tipo}: ${rotulo}`,
        occurredOn: dia, requestId: requestId.current });
      setResultado(r.ok ? "Carta marcada como enviada" : r.error);
      if (r.ok) { setGuardado(true); router.refresh(); }
    } catch { setResultado("A ligação foi interrompida. Podes repetir este registo."); }
    finally { ocupado.current = false; setPending(false); }
  }}>
    <Field label="Data de envio"><Input name="dia" type="date" defaultValue={hoje} max={hoje} required
      disabled={pending || guardado} className="min-h-11" /></Field>
    <Button type="submit" disabled={pending || guardado}>{pending ? "A guardar…" : "Marcar como enviada"}</Button>
    {resultado && <div role="status" className="text-sm text-tinta-2">{resultado}</div>}
  </form>;
}
