// Esqueleto das Cobranças: título, as três caixas e a lista de devedores.
import { Cartao, Esqueleto, Titulo, Traco } from "@/components/esqueleto";

export default function Loading() {
  return (
    <Esqueleto>
      <Titulo sub={false} />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[0, 1, 2].map((i) => (
          <Cartao key={i} className="space-y-2.5 p-3 sm:p-5">
            <Traco className="h-3 w-16" />
            <Traco className="h-7 w-24 max-w-full" />
            <Traco className="h-3 w-20" />
          </Cartao>
        ))}
      </div>
      <div>
        <Traco className="mb-3 h-6 w-32" />
        <div className="divide-y divide-regua overflow-hidden rounded-2xl border border-regua bg-carta">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3 px-4 py-4 md:px-5">
              <div className="flex justify-between gap-4">
                <Traco className="h-5 w-40" />
                <Traco className="h-6 w-24" />
              </div>
              <Traco className="h-2 w-full rounded-full" />
              <Traco className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </Esqueleto>
  );
}
