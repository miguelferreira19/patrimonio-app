"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { syncContractRents } from "@/lib/actions/import";

export function SyncRentsCard() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function sync() {
    setPending(true);
    setMessage(null);
    const res = await syncContractRents();
    setPending(false);
    if (res.ok) {
      setMessage({ ok: true, text: res.info ?? "Concluído." });
      router.refresh();
    } else {
      setMessage({ ok: false, text: res.error });
    }
  }

  return (
    <Card
      title="Sincronizar rendas"
      subtitle="Recalcula a renda de cada contrato ativo a partir da soma dos recibos do mês mais recente. Usa isto sempre que suspeitares que uma renda ficou desalinhada, sem teres de reimportar nada."
    >
      <Button onClick={sync} disabled={pending}>
        {pending ? "A sincronizar…" : "Sincronizar agora"}
      </Button>
      {message && (
        <p className={`mt-2 text-xs ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
      )}
    </Card>
  );
}
