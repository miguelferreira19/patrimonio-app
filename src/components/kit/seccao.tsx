// Sem "use client" — ver money.tsx.
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/** Uma secção de superfície: hairline e etiqueta, não uma caixa.
 *
 *  É a regra R2 da V3 feita componente. A V1 empilhava `Card` para tudo, e uma página que
 *  é uma pilha de cartões lê-se como um formulário de administração, não como um
 *  documento: cada caixa desenha uma fronteira que compete com a seguinte, e ao fim de
 *  seis o olho não sabe qual é a principal. Aqui a hierarquia é a etiqueta e o espaço.
 *
 *  O `Card` continua a existir e continua certo onde há elevação real: overlays, e os
 *  painéis de ferramenta do /admin, que são mesmo objetos separados uns dos outros.
 *
 *  `nota` é a única prosa permitida, e vive no CABEÇALHO. Nunca por baixo de um gráfico:
 *  um gráfico que precisa de um parágrafo debaixo está mal desenhado (R4).
 */
export function Seccao({
  titulo,
  valor,
  nota,
  id,
  className,
  children,
}: {
  titulo: string;
  /** À direita do título: um total, uma leitura, uma legenda. Já formatado. */
  valor?: ReactNode;
  nota?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6", className)}>
      <header className="mb-3 border-b border-regua pb-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">
            {titulo}
          </h2>
          {valor}
        </div>
        {nota && <p className="mt-1 max-w-[75ch] text-xs text-tinta-3">{nota}</p>}
      </header>
      {children}
    </section>
  );
}
