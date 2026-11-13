import { Cartao, Esqueleto, Titulo, Traco } from "@/components/esqueleto";

export default function Loading() {
  return <div className="mx-auto w-full max-w-2xl"><Esqueleto>
    <Titulo /><Cartao><Traco className="h-96 w-full" /></Cartao><Traco className="h-12 w-48" />
  </Esqueleto></div>;
}
