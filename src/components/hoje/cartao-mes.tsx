// O cartão do MÊS EM CURSO (V4 F3): a manchete de Hoje. Sem "use client".
//
// Desde a AUDITORIA_CLAREZA.md (ponto 3) a barra é a CASCATA: onde está a renda deste mês,
// em baldes disjuntos que somam o total. Antes o denominador era `esperado`, que EXCLUÍA os
// contratos de fonte parada — o cartão dizia "de 7 648 € esperados" e escondia 6 845 € que
// ninguém sabe se entraram. Agora o denominador é tudo, e o que não se sabe aparece
// hachurado, com o vocabulário do que não é dado medido.
//
// O atraso dos meses anteriores continua FORA da barra, e agora diz-se porquê: é um valor
// acumulado, de outra espécie, e somá-lo a um mês dava um número que não é de nada.

import { Money } from "@/components/kit";
import Link from "next/link";
import { mesPorExtenso } from "@/lib/format";
import type { BaldeChave, ResumoDoMes } from "@/lib/portfolio/mes";

const BALDE: Record<BaldeChave, { rotulo: string; barra: string; amostra: string; href: string }> = {
  recebido: {
    rotulo: "Recebido",
    barra: "bg-tinta",
    amostra: "bg-tinta",
    href: "/cobrancas",
  },
  por_receber: {
    rotulo: "Por receber",
    barra: "bg-vellum",
    amostra: "bg-vellum ring-1 ring-regua-forte",
    href: "/cobrancas#por-receber",
  },
  sem_informacao: {
    rotulo: "Sem informação",
    barra: "tecido-futuro bg-futuro-tenue",
    amostra: "tecido-futuro bg-futuro-tenue ring-1 ring-regua",
    href: "/cobrancas#sem-informacao",
  },
};

export function CartaoMes({ r }: { r: ResumoDoMes }) {
  const { total, baldes, contratado } = r.cascata;
  const base = total || 1;
  const visiveis = baldes.filter((b) => b.valor > 0);
  // A retenção na fonte explica a diferença entre a renda contratada (ilíquida) e a
  // cascata (líquida). É uma CONFERÊNCIA, nunca uma parcela: bases diferentes não somam.
  const retencao = contratado.iliquido > 0 ? contratado.iliquido - total : 0;

  return (
    <section className="rounded-2xl border border-regua bg-carta p-5 md:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-tinta-3">
        {mesPorExtenso(r.mes)}, em curso
      </p>
      <div className="mt-3">
        <Money value={r.recebido} escala="hero" />
      </div>
      <p className="mt-2 text-sm text-tinta-2">
        de <Money value={total} escala="sm" tom="tinta-2" /> da renda deste mês
      </p>

      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-vellum" aria-hidden="true">
        {visiveis.map((b) => (
          <span key={b.chave} className={`h-full ${BALDE[b.chave].barra}`} style={{ width: `${(b.valor / base) * 100}%` }} />
        ))}
      </div>

      <ul className="mt-3 divide-y divide-regua text-[13px]">
        {visiveis.map((b) => (
          <li key={b.chave}>
            <Link href={BALDE[b.chave].href} className="flex items-baseline justify-between gap-3 rounded-lg py-2 hover:bg-vellum">
              <span className="flex items-center gap-2 text-tinta-2">
                <i className={`size-2.5 shrink-0 rounded-[3px] ${BALDE[b.chave].amostra}`} />
                {BALDE[b.chave].rotulo}
                <span className="text-tinta-3">
                  {b.contratos} {b.contratos === 1 ? "contrato" : "contratos"}
                </span>
              </span>
              <Money value={b.valor} escala="sm" tom={b.chave === "sem_informacao" ? "futuro" : "tinta-2"} />
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-tinta-2">
        Os três somam a renda deste mês. Valores líquidos de retenção, imóveis por inteiro.
      </p>

      {r.atraso.valor > 0 && (
        <div className="mt-5 border-t border-regua pt-4 text-[13px]">
          <Link href="/cobrancas#em-atraso" className="flex items-baseline justify-between gap-3 rounded-lg py-2 hover:bg-vellum">
            <span className="text-tinta-2 underline decoration-dotted underline-offset-4">
              Em atraso de meses anteriores · {r.atraso.contratos}{" "}
              {r.atraso.contratos === 1 ? "contrato" : "contratos"}
            </span>
            <span className="shrink-0">
              <Money value={r.atraso.valor} escala="sm" tom="atencao" />{" "}
              <span className="text-xs text-tinta-3">acumulado</span>
            </span>
          </Link>
        </div>
      )}

      <details className="mt-4 text-xs leading-relaxed text-tinta-2">
        <summary className="cursor-pointer py-2 font-medium">Como ler estes valores</summary>
        <p className="mt-1">
          Um recibo emitido conta como renda recebida. Os três baldes da barra são o mesmo mês,
          repartido: o que entrou, o que falta entrar e o que não se sabe porque a fonte dos
          recibos está parada. Somam a renda deste mês e nunca se sobrepõem.
        </p>
        {contratado.iliquido > 0 && (
          <p className="mt-2">
            Os {contratado.contratos} contratos ativos valem{" "}
            <Money value={contratado.iliquido} escala="sm" tom="tinta-2" /> ilíquidos. A diferença de{" "}
            <Money value={retencao} escala="sm" tom="tinta-2" /> para a barra é a retenção na fonte:
            bases diferentes, por isso conferem-se mas não se somam.
          </p>
        )}
        <p className="mt-2">
          O atraso de meses anteriores fica fora da barra de propósito: é um valor acumulado ao
          longo de vários meses, e não uma parte deste.
        </p>
        <p className="mt-2">{r.contexto}</p>
      </details>
    </section>
  );
}
