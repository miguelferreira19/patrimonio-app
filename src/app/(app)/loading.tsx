// Esqueleto enquanto uma página de (app) carrega. Tem a forma do Hoje (a página que mais se
// abre): título do mês, o cartão do mês ao lado do gráfico dos meses fechados, e a lista.
// Estático de propósito, ver components/esqueleto.tsx.
import { Cartao, Esqueleto, Titulo, Traco } from "@/components/esqueleto";

export default function Loading() {
  return (
    <Esqueleto>
      <Titulo />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-5">
        <Cartao className="space-y-4 md:p-6">
          <Traco className="h-3 w-32" />
          <Traco className="h-10 w-44" />
          <Traco className="h-3 w-full rounded-full" />
          <div className="space-y-3 pt-1">
            <Traco className="h-4 w-full" />
            <Traco className="h-4 w-full" />
            <Traco className="h-4 w-2/3" />
          </div>
        </Cartao>
        <Cartao className="h-[340px] md:p-6">
          <Traco className="h-3 w-28" />
        </Cartao>
      </div>
      <Cartao className="space-y-4 md:p-6">
        <Traco className="h-5 w-48" />
        <Traco className="h-4 w-full" />
        <Traco className="h-4 w-full" />
      </Cartao>
    </Esqueleto>
  );
}
