// Esqueleto da Rentabilidade: título, quatro caixas e as barras por prédio.
import { Cartao, Esqueleto, Titulo, Traco } from "@/components/esqueleto";

export default function Loading() {
  return (
    <Esqueleto>
      <Titulo />
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Cartao key={i} className="space-y-2.5 p-3 sm:p-5">
            <Traco className="h-3 w-20" />
            <Traco className="h-7 w-28 max-w-full" />
          </Cartao>
        ))}
      </div>
      <div className="divide-y divide-regua overflow-hidden rounded-2xl border border-regua bg-carta">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2.5 px-4 py-3 md:px-5">
            <div className="flex justify-between gap-4">
              <Traco className="h-5 w-44" />
              <Traco className="h-6 w-24" />
            </div>
            <Traco className="h-2.5 w-full rounded-full" />
            <Traco className="h-3 w-56 max-w-full" />
          </div>
        ))}
      </div>
    </Esqueleto>
  );
}
