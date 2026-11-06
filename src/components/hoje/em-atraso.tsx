// QUEM NÃO PAGOU, o primeiro bloco do Hoje (pedido do utilizador, 06/11: "não consigo perceber
// quem é que não paga"). Sem "use client".
//
// À esquerda o total em vermelho, que é a resposta curta. À direita cada inquilino com a tira
// dos últimos 12 meses, cada quadrado com o seu mês: o vermelho com traço é um mês por pagar,
// a tinta cheia é pago. Lê-se de relance em que mês cada um deixou de pagar.
//
// A lista é `devedores` (a mesma das Cobranças): o total é o mesmo número em toda a app.

import Link from "next/link";
import { Iniciais, Money } from "@/components/kit";
import { Meses, MesesCabecalho, MesesLegenda } from "@/components/imoveis/meses";
import { Badge, buttonClass } from "@/components/ui";
import { mesPorExtenso, nomeProprio } from "@/lib/format";
import type { Ativo } from "@/lib/portfolio";
import { tiraDoInquilino } from "@/lib/portfolio/faltas";
import type { Devedor } from "@/lib/portfolio/inquilinos";
import { nomeDaFracao } from "@/lib/portfolio/predios";

/** O que cabe no Hoje; o resto está a um toque, nas Cobranças. */
const MAX_LINHAS = 6;

/** Colunas da linha: avatar, nome, tira de 12 meses, dívida. No telemóvel a tira desce. */
const GRELHA = "grid-cols-[2.5rem_minmax(0,1fr)_auto] md:grid-cols-[2.5rem_minmax(0,1fr)_auto_6.5rem]";

export function EmAtraso({
  lista,
  ativoDe,
  meses,
}: {
  lista: Devedor[];
  ativoDe: Map<string, Ativo>;
  /** Os meses das tiras, por ordem: os 12 últimos da faixa. */
  meses: string[];
}) {
  if (lista.length === 0) {
    return <p className="vazio">Ninguém em atraso.</p>;
  }

  const total = lista.reduce((a, d) => a + d.divida, 0);
  const contratos = lista.reduce((n, d) => n + d.contratos.length, 0);
  const maisAntigo = lista.reduce((m, d) => (d.desde < m.desde ? d : m), lista[0]);
  const ultimoMes = meses[meses.length - 1];
  const novos = lista.filter((d) => d.desde === ultimoMes).length;
  const linhas = lista.slice(0, MAX_LINHAS);
  const resto = lista.length - linhas.length;

  return (
    <section className="destaque overflow-hidden rounded-2xl border border-regua bg-carta lg:flex">
      <div className="flex flex-col gap-3.5 border-b border-perda/20 bg-perda-tenue p-5 md:p-7 lg:w-[280px] lg:shrink-0 lg:border-b-0 lg:border-r">
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-carta px-3 py-1 text-xs font-semibold uppercase tracking-[0.04em] text-perda">
          <i aria-hidden="true" className="size-2 rounded-full bg-perda" />
          Em atraso
        </span>
        <Money value={total} escala="hero" tom="perda" />
        <p className="text-sm leading-snug text-tinta-2">
          acumulado em{" "}
          <b className="font-semibold text-tinta">
            {lista.length} {lista.length === 1 ? "inquilino" : "inquilinos"}
          </b>{" "}
          e{" "}
          <b className="font-semibold text-tinta">
            {contratos} {contratos === 1 ? "contrato" : "contratos"}
          </b>
        </p>
        <dl className="space-y-2.5 border-t border-perda/20 pt-3.5 text-[13px]">
          <div>
            <dt className="text-tinta-2">Mais antigo</dt>
            <dd className="font-semibold text-tinta">
              desde {mesPorExtenso(maisAntigo.desde)} · {nomeProprio(maisAntigo.nome)}
            </dd>
          </div>
          {novos > 0 && (
            <div>
              <dt className="text-tinta-2">Novos em {mesPorExtenso(ultimoMes)}</dt>
              <dd className="font-semibold text-tinta">
                {novos} {novos === 1 ? "inquilino" : "inquilinos"}
              </dd>
            </div>
          )}
        </dl>
        {/* No telemóvel o painel já ocupa um ecrã: o atalho passa para o fim da lista. */}
        <Link href="/cobrancas" className={buttonClass({ variant: "primary", className: "mt-auto self-start max-lg:hidden" })}>
          Abrir cobranças
        </Link>
      </div>

      <div className="min-w-0 flex-1 p-5 md:px-7 md:py-6">
        <div className={`hidden items-end gap-x-3.5 border-b border-regua pb-2.5 md:grid ${GRELHA}`}>
          <span />
          <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-tinta-3">Inquilino</span>
          <MesesCabecalho meses={meses} tamanho="md" />
          <span className="text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-tinta-3">Dívida</span>
        </div>

        <ul className="stagger divide-y divide-regua">
          {linhas.map((d) => {
            const tira = tiraDoInquilino(
              d.contratos.map((c) => (ativoDe.get(c.contract.id)?.faixa ?? []).slice(-meses.length).map((m) => m.status)),
            );
            const piorMeses = Math.max(...d.contratos.map((c) => c.meses));
            return (
              <li key={d.chave}>
                <Link
                  href={`/inquilinos/${encodeURIComponent(d.chave)}`}
                  className={`-mx-3 grid items-center gap-x-3.5 gap-y-3 rounded-xl px-3 py-3.5 transition-colors duration-150 hover:bg-vellum ${GRELHA}`}
                >
                  <Iniciais nome={nomeProprio(d.nome)} />
                  <span className="min-w-0">
                    <span className="line-clamp-2 break-words text-[15px] font-semibold leading-snug text-tinta">{nomeProprio(d.nome)}</span>
                    <span className="block truncate text-[13px] text-tinta-2">
                      {d.contratos.length === 1 ? nomeDaFracao(d.contratos[0].property) : `${d.contratos.length} contratos`}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 md:order-last">
                    <Money value={d.divida} tom="perda" className="text-[17px] font-semibold" />
                    <Badge tone={piorMeses >= 3 ? "perda" : "atencao"}>
                      {piorMeses} {piorMeses === 1 ? "mês" : "meses"}
                    </Badge>
                  </span>
                  <Meses meses={tira} tamanho="md" className="col-span-3 md:col-span-1" />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <MesesLegenda itens={["pago", "falta", "parcial", "fora"]} />
          <Link href="/cobrancas#em-atraso" className="text-sm font-medium text-acao hover:underline lg:hidden">
            Abrir cobranças
          </Link>
          {resto > 0 && (
            <Link href="/cobrancas#em-atraso" className="text-sm font-medium text-acao hover:underline">
              Mais {resto} em Cobranças
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
