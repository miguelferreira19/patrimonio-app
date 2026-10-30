// Esqueleto dos Imóveis: título, quatro números e a grelha de cartões de prédio.
import { Cartao, Esqueleto, Titulo, Traco } from "@/components/esqueleto";

export default function Loading() {
  return (
    <Esqueleto>
      <Titulo />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Cartao key={i} className="space-y-2.5 px-4 py-3.5">
            <Traco className="h-3 w-24" />
            <Traco className="h-7 w-28" />
            <Traco className="h-3 w-20" />
          </Cartao>
        ))}
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Traco key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-regua bg-carta">
            <div className="h-[88px] bg-vellum" />
            <div className="space-y-2.5 p-4">
              <Traco className="h-4 w-36" />
              <Traco className="h-3 w-48" />
              <Traco className="mt-1 h-3.5 w-40" />
            </div>
          </div>
        ))}
      </div>
    </Esqueleto>
  );
}
