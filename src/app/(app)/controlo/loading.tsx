import { Cartao, Esqueleto, Titulo, Traco } from "@/components/esqueleto";

export default function Loading() {
  return <Esqueleto>
    <Titulo sub={false} />
    <Cartao><Traco className="h-24 w-full" /></Cartao>
    {[0, 1, 2].map((i) => <Cartao key={i}>
      <Traco className="mb-3 h-5 w-44" /><Traco className="h-11 w-full" />
    </Cartao>)}
  </Esqueleto>;
}
