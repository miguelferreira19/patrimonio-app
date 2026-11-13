import { Cartao, Esqueleto, Titulo, Traco } from "@/components/esqueleto";

export default function Loading() {
  return <div className="mx-auto w-full max-w-2xl">
    <Esqueleto>
      <Titulo sub={false} />
      <Cartao className="space-y-4">
        <Traco className="h-4 w-40" />
        <Traco className="h-16 w-52 max-w-full" />
        <Traco className="h-12 w-36 rounded-full" />
      </Cartao>
      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1].map((i) => <Cartao key={i} className="space-y-2">
          <Traco className="h-9 w-16" />
          <Traco className="h-4 w-24 max-w-full" />
          <Traco className="h-3 w-20 max-w-full" />
        </Cartao>)}
      </div>
      <Cartao className="space-y-4">
        <Traco className="h-6 w-32" />
        {[0, 1, 2].map((i) => <Traco key={i} className="h-12 w-full" />)}
      </Cartao>
    </Esqueleto>
  </div>;
}