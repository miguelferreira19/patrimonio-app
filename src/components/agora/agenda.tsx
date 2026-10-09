// "O que vem aí": os prazos dos próximos meses, no Início (2026-10-03).
//
// Uma lista com hairlines, sem cartões (R2): data à esquerda em mono, o prazo, e o valor
// quando a app o sabe. A ação principal não é clicar aqui, é LEVAR isto para o
// calendário do telemóvel, que é onde a família olha todos os dias.
//
// Sem "use client": só desenha.

import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Money } from "@/components/kit";
import type { Prazo } from "@/lib/portfolio/agenda";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

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
    <section className="rounded-2xl border border-regua bg-carta p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-[-0.01em]">Próximos prazos</h2>
        <a href="/api/agenda" className="inline-flex items-center gap-1.5 text-sm font-medium text-acao hover:underline">
          <CalendarPlus size={14} strokeWidth={1.75} aria-hidden="true" />
          Pôr no calendário
        </a>
      </div>
      {prazos.length === 0 ? (
        <p className="mt-2 text-sm text-tinta-2">Nenhum prazo nos próximos três meses.</p>
      ) : (
        <ul className="mt-2 divide-y divide-regua">
          {prazos.map((p) => (
            <li key={p.id} className="flex items-center gap-4 py-3">
              <span
                className={`grid w-12 shrink-0 place-items-center rounded-xl py-1.5 text-center ${p.data === hoje ? "bg-atencao-tenue text-atencao" : "bg-vellum text-tinta"}`}
              >
                <b className="text-base font-semibold leading-none tabular-nums">{p.data.slice(8, 10)}</b>
                <span className="mt-0.5 text-[10px] uppercase tracking-[0.05em] text-tinta-3">{MESES[parseInt(p.data.slice(5, 7), 10) - 1]}</span>
              </span>
              <div className="min-w-0 flex-1">
                {p.href ? (
                  <Link href={p.href} className="text-[15px] font-medium text-tinta hover:text-acao">
                    {p.titulo}
                  </Link>
                ) : (
                  <p className="text-[15px] font-medium text-tinta">{p.titulo}</p>
                )}
                <p className="mt-0.5 line-clamp-2 text-[13px] text-tinta-2">{p.detalhe}</p>
              </div>
              {p.euros !== null && (
                <span className="hidden shrink-0 text-sm sm:block">
                  <Money value={p.euros} escala="md" tom={p.confianca === "assumido" ? "tinta-2" : undefined} />
                  {p.tipo === "renda" && <span className="text-xs text-tinta-3">/ano</span>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {contratosSemFim > 0 && (
        <p className="mt-2 text-xs text-tinta-3">
          Os fins de contrato não entram: {contratosSemFim} contratos ativos não têm data de fim na base.
        </p>
      )}
    </section>
  );
}
