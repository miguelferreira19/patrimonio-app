"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { useAction } from "@/components/forms";
import { Select, buttonClass } from "@/components/ui";
import { apagarDocumento } from "@/lib/actions/documentos";
import { MINUTAS, MINUTA_RENDA, MINUTA_TIPOS } from "@/lib/minutas";

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

/**
 * Escolher a fração UMA vez e abrir qualquer uma das cartas para ela.
 *
 * A atualização de renda está nesta mesma lista apesar de ter rota própria
 * (`/carta/[id]`, porque depende do coeficiente do ano e da elegibilidade do contrato):
 * essa é uma distinção de implementação, e ter um segundo seletor por causa dela obrigava
 * a escolher a fração duas vezes na mesma página. Quem escreve uma carta não quer saber
 * de que rota a serve.
 */
export function EscolherMinuta({ contratos }: { contratos: ContratoOpcao[] }) {
  const [contratoId, setContratoId] = useState(contratos[0]?.id ?? "");

  if (contratos.length === 0) {
    return <p className="text-sm text-tinta-2">Sem contratos ativos para gerar cartas.</p>;
  }

  // Todas descarregam .docx do mesmo sítio (`/api/minuta/...`), incluindo a atualização de
  // renda. Uma carta destas quase nunca sai como está — falta o mês em dívida, a data de
  // entrega, o IBAN — por isso o que serve é um ficheiro que se abre no Word e se edita,
  // não uma página para imprimir.
  const cartas = [
    ...MINUTA_TIPOS.map((tipo) => ({
      chave: tipo as string,
      label: MINUTAS[tipo].label,
      descricao: MINUTAS[tipo].descricao,
    })),
    { chave: "renda", label: MINUTA_RENDA.label, descricao: MINUTA_RENDA.descricao },
  ];

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
        {cartas.map((c) => (
          <li key={c.chave} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-tinta">{c.label}</p>
              <p className="text-xs text-tinta-2">{c.descricao}</p>
            </div>
            <a
              href={`/api/minuta/${c.chave}/${contratoId}`}
              className={buttonClass({ variant: "outline", size: "sm" })}
            >
              <Download size={14} strokeWidth={1.75} />
              Word
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
