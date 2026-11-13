import { Cartao, Esqueleto, Titulo, Traco } from "@/components/esqueleto";

export default function Loading() {
  return <Esqueleto>
    <Titulo sub={false} />
    <Traco className="h-11 w-full" />
    <Cartao className="space-y-3"><Traco className="h-5 w-48" /><Traco className="h-16 w-full" /></Cartao>
    {[0, 1, 2].map((i) => <div key={i} className="space-y-3">
      <Traco className="h-5 w-40" /><Traco className="h-11 w-full" />
    </div>)}
  </Esqueleto>;
}