// Uma fração, um contrato ou um ano que não existe (ou que foi apagado entretanto).
// Sem isto, o `notFound()` das fichas caía na página genérica do Next, em inglês.
import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NaoEncontrado() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">
        Não encontrado
      </p>
      <h1 className="mt-2 font-serif text-3xl text-tinta">Isto já não existe, ou nunca existiu.</h1>
      <p className="mt-3 text-sm leading-relaxed text-tinta-2">
        O endereço pode vir de um marcador antigo, ou o registo pode ter sido apagado.
      </p>
      <Link href="/imoveis" className={buttonClass({ variant: "outline", className: "mt-6" })}>
        Ir para Imóveis
      </Link>
    </div>
  );
}
