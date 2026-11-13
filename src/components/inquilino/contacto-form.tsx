"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { registarNoDiario } from "@/lib/actions/diario";
import { parseAmount } from "@/lib/parse";

type Tipo = "contacto" | "promessa" | "nota";

export function ContactoForm({ contractId, hoje, requestId }: {
  contractId: string; hoje: string; requestId: string;
}) {
  const [tipo, setTipo] = useState<Tipo>("contacto");
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState("");
  const ocupado = useRef(false);
  const router = useRouter();
  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ocupado.current) return;
    ocupado.current = true;
    const form = event.currentTarget;
    const dados = new FormData(form);
    const texto = (campo: string) => String(dados.get(campo) ?? "").trim();
    setPending(true);
    setErro("");
    try {
      const r = await registarNoDiario({
        contractId, kind: tipo, note: texto("note"), occurredOn: texto("dia"), requestId,
        ...(tipo === "promessa" ? { dueDate: texto("prometida"),
          ...(texto("valor") ? { amount: parseAmount(texto("valor")) ?? NaN } : {}) } : {}),
      });
      if (!r.ok) setErro(r.error);
      else { form.closest("dialog")?.close(); router.refresh(); }
    } catch {
      setErro("A ligação foi interrompida. Podes repetir este registo.");
    } finally { ocupado.current = false; setPending(false); }
  }
  return <form onSubmit={guardar} className="space-y-4">
    <fieldset disabled={pending} className="space-y-4">
      <Field label="Tipo"><Select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
        <option value="contacto">Contacto</option><option value="promessa">Promessa de pagamento</option>
        <option value="nota">Nota</option>
      </Select></Field>
      <Field label="Texto"><Textarea name="note" required minLength={1} maxLength={500} rows={4} /></Field>
      <Field label="Data"><Input name="dia" type="date" defaultValue={hoje} max={hoje} required /></Field>
      {tipo === "promessa" && <>
        <Field label="Data prometida"><Input name="prometida" type="date" required /></Field>
        <Field label="Valor prometido (opcional)"><Input name="valor" inputMode="decimal" /></Field>
      </>}
    </fieldset>
    {erro && <p role="alert" className="text-sm text-perda">{erro}</p>}
    <Button type="submit" disabled={pending}>{pending ? "A guardar…" : "Guardar registo"}</Button>
  </form>;
}
