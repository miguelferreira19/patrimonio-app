// O cartão do MÊS EM CURSO (V4 F3): a manchete de Hoje. Sem "use client".
//
// A barra empilhada responde de uma vez a "quanto entrou e quanto falta". O atraso a sério
// (meses anteriores) vive por baixo, numa linha à parte: misturá-lo na barra do mês era
// voltar aos três números que não batiam certo.

import { Money } from "@/components/kit";
import { mesPorExtenso } from "@/lib/format";
import type { ResumoDoMes } from "@/lib/portfolio/mes";

export function CartaoMes({ r }: { r: ResumoDoMes }) {
  const base = r.esperado || 1;
  const pRecebido = Math.min(100, (r.recebido / base) * 100);
  return (
    <section className="rounded-2xl border border-regua bg-carta p-5 shadow-[0_1px_2px_rgba(15,21,23,0.04)] md:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-tinta-3">
        {mesPorExtenso(r.mes)}, em curso
      </p>
      <div className="mt-3">
        <Money value={r.recebido} escala="hero" />
      </div>
      <p className="mt-2 text-sm text-tinta-2">
        de <Money value={r.esperado} escala="sm" tom="tinta-2" /> esperados · {r.pagos} de {r.total} contratos pagos
      </p>
      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-vellum" aria-hidden="true">
        <span className="h-full bg-tinta" style={{ width: `${pRecebido}%` }} />
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-tinta-2">
        <li className="flex items-center gap-2">
          <i className="size-2.5 rounded-[3px] bg-tinta" />
          Recebido <Money value={r.recebido} escala="sm" tom="tinta-2" />
        </li>
        <li className="flex items-center gap-2">
          <i className="size-2.5 rounded-[3px] bg-vellum ring-1 ring-regua-forte" />
          Por receber <Money value={r.porReceber} escala="sm" tom="tinta-2" />
        </li>
      </ul>
      {(r.atraso.valor > 0 || r.porSaber.contratos > 0) && (
        <div className="mt-5 space-y-1.5 border-t border-regua pt-4 text-[13px]">
          {r.atraso.valor > 0 && (
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-tinta-2">
                Em atraso de meses anteriores · {r.atraso.contratos}{" "}
                {r.atraso.contratos === 1 ? "contrato" : "contratos"}
              </span>
              <Money value={r.atraso.valor} escala="sm" tom="perda" />
            </p>
          )}
          {r.porSaber.contratos > 0 && (
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-tinta-2">
                Por saber · {r.porSaber.contratos} contratos com os recibos parados
              </span>
              <Money value={r.porSaber.valor} escala="sm" tom="futuro" />
            </p>
          )}
        </div>
      )}
    </section>
  );
}
