// "O que vem aí": os prazos dos próximos meses, no Início (2026-10-03).
//
// Uma lista com hairlines, sem cartões (R2): data à esquerda em mono, o prazo, e o valor
// quando a app o sabe. A ação principal não é clicar aqui, é LEVAR isto para o
// calendário do telemóvel, que é onde a família olha todos os dias.
//
// Sem "use client": só desenha.

import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Money, Seccao } from "@/components/kit";
import { buttonClass } from "@/components/ui";
import type { Prazo } from "@/lib/portfolio/agenda";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function dia(iso: string): string {
  return `${iso.slice(8, 10)} ${MESES[parseInt(iso.slice(5, 7), 10) - 1]}`;
}

export function Agenda({
  prazos,
  hoje,
  contratosSemFim,
}: {
  prazos: Prazo[];
  hoje: string;
  /** Contratos ativos sem `end_date`: sem ela não há oposição à renovação para agendar. */
  contratosSemFim: number;
}) {
  return (
    <Seccao
      titulo="O que vem aí"
      valor={
        <a href="/api/agenda" className={buttonClass({ variant: "ghost", size: "sm" })}>
          <CalendarPlus size={14} strokeWidth={1.75} aria-hidden="true" />
          Pôr no calendário
        </a>
      }
      nota={
        contratosSemFim > 0
          ? `Os fins de contrato não entram: ${contratosSemFim} contratos ativos não têm data de fim na base.`
          : undefined
      }
    >
      {prazos.length === 0 ? (
        <p className="py-3 text-sm text-tinta-2">Nenhum prazo nos próximos meses.</p>
      ) : (
        <ul className="divide-y divide-regua">
          {prazos.map((p) => (
            <li key={p.id} className="flex items-baseline gap-4 py-3">
              <span
                className={`w-14 shrink-0 font-mono text-xs tabular-nums ${p.data === hoje ? "text-atencao" : "text-tinta-3"}`}
              >
                {p.data === hoje ? "hoje" : dia(p.data)}
              </span>
              <div className="min-w-0 flex-1">
                {p.href ? (
                  <Link
                    href={p.href}
                    className="font-medium text-tinta transition-colors duration-150 hover:text-acao"
                  >
                    {p.titulo}
                  </Link>
                ) : (
                  <p className="font-medium text-tinta">{p.titulo}</p>
                )}
                <p className="mt-0.5 text-sm text-tinta-2">{p.detalhe}</p>
              </div>
              {p.euros !== null && (
                <span className="shrink-0">
                  <Money value={p.euros} escala="sm" tom={p.confianca === "assumido" ? "tinta-2" : undefined} />
                  {p.tipo === "renda" && <span className="text-xs text-tinta-3">/ano</span>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Seccao>
  );
}
