"use client";

import { useEffect, useRef, useState } from "react";
import { Folha } from "@/components/folha";
import { PaymentForm } from "@/components/gestao/forms";
import { ContactoForm } from "@/components/inquilino/contacto-form";
import { Field, Select } from "@/components/ui";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import type { Contract, Property } from "@/lib/types";

export type ContratoParaRegisto = { contract: Contract; property: Property; month: string; expected: number };
type Props = { contratos: ContratoParaRegisto[]; hoje: string; abrir?: boolean };

function Conteudo({ contratos, hoje, requestId, pagamento }: Props & { requestId: string; pagamento: boolean }) {
  const [id, setId] = useState(contratos.length === 1 ? contratos[0].contract.id : "");
  const escolhido = contratos.find((c) => c.contract.id === id);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector("details")?.setAttribute("open", ""); }, [id, pagamento]);
  return <div ref={ref} className="space-y-4 [&_input]:min-h-11 [&_select]:min-h-11 [&_summary]:min-h-11">
    {contratos.length > 1 && <Field label="Contrato"><Select value={id} onChange={(e) => setId(e.target.value)} required>
      <option value="">Escolher contrato</option>
      {contratos.map(({ contract, property }) => <option key={contract.id} value={contract.id}>
        {nomeDaFracao(property)} · {contract.pf_contract_no ?? "Contrato"}
      </option>)}
    </Select></Field>}
    {escolhido && (pagamento ? <PaymentForm key={id} {...escolhido} receipts={[]} /> :
      <ContactoForm key={id} contractId={id} hoje={hoje} requestId={requestId} />)}
  </div>;
}

function Abertura({ contratos, hoje, abrir, pagamento }: Props & { pagamento: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [requestId, setRequestId] = useState("");
  useEffect(() => {
    if (abrir) ref.current?.querySelector("button")?.click();
  }, [abrir]);
  return <div ref={ref} onClickCapture={(event) => {
    if (event.target instanceof Element && event.target.closest("button") === ref.current?.firstElementChild) {
      setRequestId(crypto.randomUUID());
    }
  }} className="min-w-0 [&>button]:w-full">
    <Folha rotulo={pagamento ? "Pagou" : "Falei com ele"}
      titulo={pagamento ? "Registar pagamento" : "Registar contacto"} variante={pagamento ? "primary" : "outline"}>
      {requestId && <Conteudo key={requestId} contratos={contratos} hoje={hoje}
        requestId={requestId} pagamento={pagamento} />}
    </Folha>
  </div>;
}

export function RegistarFolha(props: Props) {
  if (!props.contratos.length) return null;
  return <div className="grid grid-cols-2 gap-2.5">
    <Abertura {...props} pagamento />
    <Abertura {...props} abrir={false} pagamento={false} />
  </div>;
}
