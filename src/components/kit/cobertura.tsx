// Sem "use client" — ver money.tsx.
import Link from "next/link";
import { cn } from "@/lib/cn";
import { monthLabel } from "@/lib/format";

export interface CoberturaFactos {
  /** Último mês com recibos importados na carteira (chave "YYYY-MM-01"), ou null.
   *  É o `dataHorizonMonth` de arrears.ts: a partir daqui a app NÃO afirma nada. */
  fronteira: string | null;
  senhoriosModelados: number;
  senhoriosTotal: number;
  fichasIncompletas: number;
}

/** A tira de cobertura: o que a app sabe, e até onde.
 *
 *  Porque existe: nesta carteira a incerteza é estrutural. Os recibos entram em
 *  LOTE, com semanas de atraso, e enquanto o mês corrente não é importado a app não
 *  tem como distinguir "ninguém pagou" de "ainda não importei". A V1 resolvia isto
 *  com uma trava interna (`dataHorizonMonth`) invisível ao utilizador e um parágrafo
 *  de rodapé. Aqui a fronteira é dita em voz alta, em todas as superfícies.
 *
 *  Regra: esta tira nunca alarma e nunca usa cor de estado. É informação sobre o
 *  CONHECIMENTO, não sobre o dinheiro (PLANO.md §7.5).
 */
export function Cobertura({
  factos,
  className,
}: {
  factos: CoberturaFactos;
  className?: string;
}) {
  const { fronteira, senhoriosModelados, senhoriosTotal, fichasIncompletas } = factos;

  const itens: Array<{ texto: string; title: string; href?: string }> = [];

  itens.push(
    fronteira
      ? {
          texto: `Conhecido até ${monthLabel(fronteira)}`,
          title:
            "Último mês com recibos importados. A app não conta atrasos para além " +
            "deste mês: sem o import, «sem recibo» e «não pagou» são indistinguíveis.",
        }
      : {
          texto: "Sem recibos importados",
          title: "Nenhum pagamento na carteira. Todos os números de cobrança estão vazios.",
        },
  );

  if (senhoriosTotal > 0 && senhoriosModelados < senhoriosTotal) {
    itens.push({
      texto: `${senhoriosModelados} de ${senhoriosTotal} senhorios`,
      title:
        `${senhoriosTotal - senhoriosModelados} senhorio(s) sem frações associadas: ` +
        "as frações e rendas deles não entram em nenhum número desta app.",
    });
  }

  if (fichasIncompletas > 0) {
    itens.push({
      texto: `${fichasIncompletas} ${fichasIncompletas === 1 ? "ficha" : "fichas"} por completar`,
      title:
        "Sem área, tipologia, freguesia ou VPT não há €/m² vs mercado, nem valor " +
        "estimado, nem elegibilidade à taxa reduzida do art. 72.º.",
      href: "/saude",
    });
  }

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-tinta-3",
        className,
      )}
    >
      {itens.map((item, i) => (
        <span key={item.texto} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          {item.href ? (
            <Link
              href={item.href}
              title={item.title}
              className="underline decoration-dotted decoration-1 underline-offset-2 hover:text-tinta-2"
            >
              {item.texto}
            </Link>
          ) : (
            <span
              title={item.title}
              className="cursor-help underline decoration-dotted decoration-1 underline-offset-2"
            >
              {item.texto}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
