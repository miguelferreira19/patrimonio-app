import { Cartao, Esqueleto, Titulo, Traco } from "@/components/esqueleto";

export default function Loading() {
  return <div className="mx-auto w-full max-w-2xl"><Esqueleto>
    <Titulo sub={false} /><Cartao><Traco className="h-44 w-full" /></Cartao>
    <Cartao><Traco className="h-32 w-full" /></Cartao>
  </Esqueleto></div>;
}
