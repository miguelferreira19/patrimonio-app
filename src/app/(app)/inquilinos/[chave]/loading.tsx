import { Cartao, Esqueleto, Titulo, Traco } from "@/components/esqueleto";

export default function Loading() {
  return <div className="mx-auto w-full max-w-2xl"><Esqueleto>
    <Cartao><Titulo /><Traco className="mt-5 h-16 w-48" /></Cartao>
    <Traco className="h-14 w-full" /><Traco className="h-12 w-full" />
    <Cartao><Traco className="h-36 w-full" /></Cartao>
  </Esqueleto></div>;
}
