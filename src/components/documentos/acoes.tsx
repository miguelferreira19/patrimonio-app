"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAction } from "@/components/forms";
import { Button, Select, buttonClass } from "@/components/ui";
import { apagarDocumento } from "@/lib/actions/documentos";
import { MINUTAS, MINUTA_TIPOS } from "@/lib/minutas";

export function ApagarDocumento({ path, nome }: { path: string; nome: string }) {
  const { pending, error, run } = useAction();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        title="Apagar"
        onClick={() => {
          if (confirm(`Apagar "${nome}"? Não há forma de recuperar.`)) void run(apagarDocumento(path));
        }}
        className="rounded-lg p-1.5 text-tinta-3 transition-colors hover:bg-perda-tenue hover:text-perda disabled:opacity-50"
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </button>
      {error && <span className="text-xs text-perda">{error}</span>}
    </>
  );
}

export interface ContratoOpcao {
  id: string;
  label: string;
}

/** Escolher o contrato uma vez e abrir qualquer uma das minutas para ele. A alternativa
 *  era um link por minuta em cada ficha de fração: quatro CTAs a mais em 50 páginas. */
export function EscolherMinuta({ contratos }: { contratos: ContratoOpcao[] }) {
  const [contratoId, setContratoId] = useState(contratos[0]?.id ?? "");

  if (contratos.length === 0) {
    return <p className="text-sm text-tinta-2">Sem contratos para gerar minutas.</p>;
  }

  return (
    <div className="space-y-3">
      <Select value={contratoId} onChange={(e) => setContratoId(e.target.value)}>
        {contratos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>

      <ul className="divide-y divide-regua border-t border-regua">
        {MINUTA_TIPOS.map((tipo) => {
          const m = MINUTAS[tipo];
          return (
            <li key={tipo} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-tinta">{m.label}</p>
                <p className="text-xs text-tinta-2">{m.descricao}</p>
                <p className="mt-0.5 text-[11px] text-tinta-3">{m.base}</p>
              </div>
              <a
                href={`/minutas/${tipo}/${contratoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass({ variant: "outline", size: "sm" })}
              >
                Abrir
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Igual ao de cima mas para a carta de atualização de renda, que tem rota própria porque
 *  depende do coeficiente do ano e da elegibilidade do contrato. */
export function EscolherCarta({ contratos }: { contratos: ContratoOpcao[] }) {
  const [contratoId, setContratoId] = useState(contratos[0]?.id ?? "");
  if (contratos.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={contratoId}
        onChange={(e) => setContratoId(e.target.value)}
        className="max-w-xs flex-1"
      >
        {contratos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
      <Button as="a" variant="outline" size="sm" href={`/carta/${contratoId}`} target="_blank" rel="noopener noreferrer">
        Abrir
      </Button>
    </div>
  );
}
