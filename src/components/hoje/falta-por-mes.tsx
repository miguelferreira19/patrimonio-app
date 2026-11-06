// O QUE FALTOU EM CADA MÊS, e a quem (pedido do utilizador, 06/11: os gráficos "não traziam
// informação"). Sem "use client": são caixas, não um gráfico de biblioteca.
//
// A altura da coluna é o que NÃO entrou nesse mês, com o valor por cima e, por baixo do mês,
// quantos contratos faltaram. Medir a renda esperada deixava a falta numa fatia fina de
// poucos pixéis: o gráfico mostrava que quase tudo foi pago e escondia o que interessa. Em
// baixo os nomes do último mês, e num "Detalhes" os dos anteriores. Vem de `faltasPorMes`, as
// mesmas células das tiras de cada inquilino, por isso o gráfico e a lista de quem deve nunca
// se contradizem.
//
// Substitui o `FluxoMensalChart` do Hoje: recebido contra uma linha tracejada dizia QUANTO,
// nunca QUEM.

import { Money } from "@/components/kit";
import { fmtEur, mesPorExtenso, monthLabel, nomeProprio } from "@/lib/format";
import type { FaltaDoMes } from "@/lib/portfolio/faltas";

/** "Ana Silva, Rui Costa (2)": os contratos do mesmo inquilino agrupam-se. */
function nomesDosEmFalta(contratos: FaltaDoMes["contratos"]): string {
  const porNome = new Map<string, number>();
  for (const c of contratos) {
    const nome = nomeProprio(c.nome);
    porNome.set(nome, (porNome.get(nome) ?? 0) + 1);
  }
  return Array.from(porNome, ([nome, n]) => (n > 1 ? `${nome} (${n})` : nome)).join(", ");
}

export function FaltaPorMes({ dados }: { dados: FaltaDoMes[] }) {
  if (dados.length === 0) {
    return (
      <section className="rounded-2xl border border-regua bg-carta p-5 md:p-6">
        <p className="py-10 text-center text-sm text-tinta-2">Ainda não há meses fechados com recibos importados.</p>
      </section>
    );
  }

  const maxFalta = Math.max(1, ...dados.map((d) => d.falta));
  const ultimo = dados[dados.length - 1];
  const anteriores = dados.slice(0, -1).filter((d) => d.contratos.length > 0).reverse();
  const resumo = dados
    .map((d) => `${monthLabel(d.month, false)}: ${d.falta > 0 ? `${fmtEur(d.falta)} em falta` : "tudo recebido"}`)
    .join("; ");

  return (
    <section className="rounded-2xl border border-regua bg-carta p-5 md:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-tinta-3">Últimos {dados.length} meses fechados</p>
      <p className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-tinta">
        {ultimo.falta > 0 ? (
          <>
            Em falta em {mesPorExtenso(ultimo.month)}: <Money value={ultimo.falta} escala="xl" tom="perda" /> em{" "}
            {ultimo.contratos.length} {ultimo.contratos.length === 1 ? "contrato" : "contratos"}
          </>
        ) : (
          <>{mesPorExtenso(ultimo.month).replace(/^./, (l) => l.toUpperCase())}: tudo recebido</>
        )}
      </p>
      <p className="mt-1 text-[13px] text-tinta-2">A altura de cada coluna é o que ficou por receber nesse mês.</p>

      <ol className="mt-5 flex items-end gap-1.5" role="img" aria-label={resumo}>
        {dados.map((d, i) => {
          const pctFalta = (d.falta / maxFalta) * 100;
          return (
            <li key={d.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="h-4 whitespace-nowrap text-[11px] font-semibold tabular-nums text-perda">
                {d.falta > 0 ? Math.round(d.falta) : ""}
              </span>
              <div
                className="celula-in flex h-40 w-full max-w-11 flex-col justify-end overflow-hidden rounded-lg bg-vellum"
                style={{ "--c": i } as React.CSSProperties}
              >
                {d.falta > 0 && <span className="block w-full bg-perda" style={{ height: `${pctFalta}%`, minHeight: 4 }} />}
              </div>
              <span className="text-xs text-tinta-2">{monthLabel(d.month, false)}</span>
              <span
                className={
                  d.contratos.length > 0
                    ? "grid h-5 min-w-5 place-items-center rounded-full bg-perda-tenue px-1.5 text-[11px] font-bold text-perda"
                    : "h-5"
                }
              >
                {d.contratos.length > 0 ? d.contratos.length : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-tinta-2">
        <li className="flex items-center gap-1.5">
          <i aria-hidden="true" className="size-3 rounded-[4px] bg-perda" />
          Em falta (€, por cima da coluna)
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-perda-tenue text-[10.5px] font-bold text-perda">
            3
          </span>
          Contratos em falta
        </li>
      </ul>

      {ultimo.contratos.length > 0 && (
        <p className="mt-4 rounded-xl bg-perda-tenue px-4 py-3 text-[13.5px] leading-relaxed text-tinta">
          <b className="font-semibold text-perda">{mesPorExtenso(ultimo.month).replace(/^./, (l) => l.toUpperCase())}, em falta:</b>{" "}
          {nomesDosEmFalta(ultimo.contratos)}
        </p>
      )}

      {anteriores.length > 0 && (
        <details className="mt-3 text-[13px] text-tinta-2">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-acao">
            Quem faltou nos meses anteriores
          </summary>
          <ul className="divide-y divide-regua">
            {anteriores.map((d) => (
              <li key={d.month} className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="min-w-0">
                  <b className="font-semibold text-tinta">{monthLabel(d.month)}</b>
                  <span className="block text-tinta-2">{nomesDosEmFalta(d.contratos)}</span>
                </span>
                <Money value={d.falta} escala="md" tom="perda" className="shrink-0" />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
