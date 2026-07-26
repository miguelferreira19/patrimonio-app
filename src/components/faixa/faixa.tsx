"use client";

// A FAIXA (PLANO.md §5): uma linha por fração, o tempo a correr para a direita, e a
// altura de cada barra a valer a fração da renda que entrou.
//
// Não é um componente novo: é a grelha do `payments-grid.tsx` da V1 promovida a objeto
// central. O que lhe foi acrescentado é o que a tornava indispensável e não existia —
// o eixo temporal com etiquetas de ano, a LINHA DA FRONTEIRA desenhada com rótulo, a
// coluna da direita que muda com a lente, e a linha final com a carteira inteira.
// Em troca, morreram três vistas: a grelha de Pagamentos, a de Atrasos e a da ficha.
//
// Client só por causa do modal de pagamento e do estado de célula selecionada. Tudo o
// que é cálculo já vem feito do snapshot — este ficheiro não decide o estado de nenhum
// mês, só o desenha (a verdade única vive em `lib/monthcell.ts`).

import { useMemo, useState } from "react";
import Link from "next/link";
import { Celula, CelulaLegenda } from "./celula";
import { PagamentoModal } from "./pagamento-modal";
import { Money } from "@/components/kit";
import { cn } from "@/lib/cn";
import { monthLabel } from "@/lib/format";
import type { MonthCellData } from "@/lib/monthcell";
import type { Contract, Payment } from "@/lib/types";

/** Uma linha da faixa. A página é que a constrói a partir do snapshot — a lente decide
 *  o que vai na coluna da direita, nunca este componente. */
export interface LinhaFaixa {
  id: string;
  nome: string;
  /** Segunda linha do rótulo: inquilino, tipologia, "vago desde…". */
  sub: string;
  /** Ponto à esquerda do nome: arrendado (tinta), vago (ardósia), atenção (âmbar). */
  estado: "arrendado" | "vago" | "atencao";
  href: string;
  celulas: MonthCellData[];
  /** Coluna da direita, ditada pela lente. `valor` é euros; `nota` é a linha de baixo. */
  valor: number | null;
  nota: string;
  notaTom?: "tinta-2" | "perda" | "atencao" | "futuro";
  /** Contrato ativo, quando existe: é o que permite marcar um pagamento na célula. */
  contract: Contract | null;
}

const PONTO: Record<LinhaFaixa["estado"], string> = {
  arrendado: "bg-tinta",
  vago: "bg-futuro",
  atencao: "bg-atencao",
};

const NOTA_TOM = {
  "tinta-2": "text-tinta-2",
  perda: "text-perda",
  atencao: "text-atencao",
  futuro: "text-futuro",
} as const;

export function Faixa({
  linhas,
  meses,
  horizon,
  carteira,
  isAdmin,
  pagamentos,
}: {
  linhas: LinhaFaixa[];
  meses: string[];
  /** Último mês com recibos. A linha da fronteira desenha-se logo a seguir a ele. */
  horizon: string | null;
  /** A faixa da carteira inteira: a última linha, e o que substitui o gráfico de fluxo. */
  carteira: MonthCellData[];
  isAdmin: boolean;
  /** Pagamentos da janela, para o modal saber se a célula já tem linha. */
  pagamentos: Payment[];
}) {
  const [celula, setCelula] = useState<{ linha: LinhaFaixa; mes: string } | null>(null);

  const pagamentoPorChave = useMemo(
    () => new Map(pagamentos.map((p) => [`${p.contract_id}:${p.ref_month.slice(0, 7)}`, p])),
    [pagamentos],
  );

  // Índice do primeiro mês ALÉM da fronteira: é onde se desenha a linha vertical. -1
  // quando tudo o que está no ecrã já é conhecido.
  const iFronteira = horizon ? meses.findIndex((m) => m > horizon) : 0;

  // `minmax(0,1fr)` e não `1fr`: sem o minmax, uma célula com conteúdo largo estica a
  // coluna e desalinha a faixa toda das outras linhas.
  const grelha = { gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` };

  const estados = useMemo(() => {
    const vistos = new Set<MonthCellData["status"]>();
    for (const l of linhas) for (const c of l.celulas) vistos.add(c.status);
    return (["pago", "parcial", "falta", "fora", "futuro"] as const).filter((s) => vistos.has(s));
  }, [linhas]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Eixo: só os meses de janeiro levam o ano, senão são 24 rótulos a competir
              com as barras pela atenção. */}
          <div className="flex items-end gap-3 pb-1">
            <div className="w-[240px] shrink-0" />
            <div className="relative grid flex-1 gap-[2px]" style={grelha}>
              {meses.map((m) => (
                <span
                  key={m}
                  className="text-center font-mono text-[9px] leading-none text-tinta-3"
                >
                  {m.slice(5, 7) === "01" ? m.slice(0, 4) : ""}
                </span>
              ))}
              <Fronteira i={iFronteira} n={meses.length} rotulo />
            </div>
            <div className="w-[112px] shrink-0" />
          </div>

          <ul className="divide-y divide-regua border-y border-regua">
            {linhas.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-1.5">
                <div className="flex w-[240px] shrink-0 items-baseline gap-2">
                  <span
                    aria-hidden="true"
                    className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", PONTO[l.estado])}
                  />
                  <div className="min-w-0">
                    <Link
                      href={l.href}
                      className="block truncate text-[13px] font-medium text-tinta hover:text-acao hover:underline"
                    >
                      {l.nome}
                    </Link>
                    <p className="truncate text-[11px] text-tinta-3">{l.sub}</p>
                  </div>
                </div>

                <div className="relative grid flex-1 gap-[2px]" style={grelha}>
                  {l.celulas.map((c) => (
                    <Celula
                      key={c.month}
                      cell={c}
                      className="h-7"
                      onClick={
                        isAdmin && l.contract && c.status !== "fora"
                          ? () => setCelula({ linha: l, mes: c.month })
                          : undefined
                      }
                    />
                  ))}
                  <Fronteira i={iFronteira} n={meses.length} />
                </div>

                <div className="w-[112px] shrink-0 text-right">
                  {l.valor !== null && <Money value={l.valor} escala="sm" />}
                  <p className={cn("text-[11px]", NOTA_TOM[l.notaTom ?? "tinta-2"])}>{l.nota}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* A carteira inteira como última faixa. É isto que torna o gráfico
              "Últimos 12 meses" redundante: a substância já é o gráfico. */}
          {carteira.length > 0 && (
            <div className="flex items-center gap-3 border-b border-regua-forte py-1.5">
              <div className="w-[240px] shrink-0 text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-2">
                Carteira
              </div>
              <div className="relative grid flex-1 gap-[2px]" style={grelha}>
                {carteira.map((c) => (
                  <Celula key={c.month} cell={c} className="h-7" />
                ))}
                <Fronteira i={iFronteira} n={meses.length} />
              </div>
              <div className="w-[112px] shrink-0" />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <CelulaLegenda estados={estados} />
        <p className="text-[11px] text-tinta-3">
          {meses.length} meses · {linhas.length} {linhas.length === 1 ? "fração" : "frações"}
          {horizon ? ` · dados até ${monthLabel(horizon)}` : " · sem recibos importados"}
        </p>
      </div>

      {celula?.linha.contract && (
        <PagamentoModal
          contract={celula.linha.contract}
          nome={celula.linha.nome}
          month={celula.mes}
          payment={pagamentoPorChave.get(
            `${celula.linha.contract.id}:${celula.mes.slice(0, 7)}`,
          )}
          onClose={() => setCelula(null)}
        />
      )}
    </div>
  );
}

/** A fronteira do conhecido, desenhada. Deixa de ser detalhe de implementação e passa a
 *  ser o elemento mais honesto da app: à direita desta linha, a app não afirma nada. */
function Fronteira({ i, n, rotulo = false }: { i: number; n: number; rotulo?: boolean }) {
  if (i < 0 || i >= n) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-20 border-l border-dashed border-futuro/70"
      style={{ left: `${(i / n) * 100}%` }}
    >
      {rotulo && (
        <span className="absolute -top-0.5 left-1 whitespace-nowrap text-[9px] leading-none text-futuro">
          por importar
        </span>
      )}
    </span>
  );
}
