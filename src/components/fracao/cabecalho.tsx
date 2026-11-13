import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { DeletePropertyButton, EndContractButton, PropertyFormButton } from "@/components/forms";
import { Bloco, Figure, Money } from "@/components/kit";
import { ListaProblemas } from "@/components/imoveis/problemas";
import { fmtNum, fmtPct, nomeProprio } from "@/lib/format";
import { chaveDoInquilino } from "@/lib/portfolio/inquilinos";
import { normalizarMorada } from "@/lib/portfolio/predios";
import type { DadosFracao } from "./dados";

function AcoesDaFracao({ dados: d }: { dados: DadosFracao }) {
  if (!d.isAdmin) return null;
  return <div className="flex flex-wrap items-center gap-2">
    <PropertyFormButton landlords={d.landlords} geoOptions={d.geoOptions} property={d.property} owners={d.owners} small />
    <details className="relative">
      <summary aria-label="Mais ações" className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-full bg-carta text-tinta-2">
        <MoreHorizontal size={18} />
      </summary>
      <div className="absolute right-0 z-30 mt-2 flex w-56 flex-col gap-1 rounded-[20px] border border-regua bg-elevado p-2">
        {d.active && <EndContractButton contractId={d.active.id} />}
        <DeletePropertyButton id={d.property.id} />
      </div>
    </details>
  </div>;
}

export function CabecalhoFracao({ dados: d }: { dados: DadosFracao }) {
  const emAtraso = d.problemas.some((p) => p.tipo === "em_atraso");
  const estado = emAtraso ? "Em atraso" : d.active ? d.semInformacao ? "Sem informação" : "Em dia"
    : d.property.status === "terreno" ? "Terreno" : d.property.status === "vendido" ? "Vendida" : "Vaga";
  const tom = emAtraso ? "perda" : d.active ? d.semInformacao ? "futuro" : "tinta" : "neutro";
  return <>
    <header>
      <Bloco tom={tom} tamanho="heroi" rotulo={estado}>
        <h1 className="font-display text-2xl font-bold leading-tight">{d.rotulo}</h1>
        {d.active ? <Link href={`/inquilinos/${encodeURIComponent(chaveDoInquilino(d.active))}`}
          className="inline-flex min-h-11 items-center text-base font-semibold underline">{nomeProprio(d.active.tenant_name)}</Link>
          : <span className="text-sm">Sem contrato</span>}
        {d.active && <div className="text-sm"><Money value={d.active.rent} escala="xl" className="text-inherit" /> por mês</div>}
      </Bloco>
    </header>
    <ListaProblemas itens={d.problemas.map((problema) => ({ problema }))} />
    <AcoesDaFracao dados={d} />
    <details className="rounded-[20px] bg-carta px-4 py-2 text-sm text-tinta-2">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-tinta">Detalhes</summary>
      <dl className="space-y-2 pb-3">
        <div><dt>Morada</dt><dd>{normalizarMorada(d.property.address) ?? "Sem morada"}</dd></div>
        <div><dt>Tipologia e área</dt><dd>{d.property.typology}{d.property.area_m2 != null && <> · <Figure value={fmtNum(d.property.area_m2, 0)} unit="m²" /></>}</dd></div>
        <div><dt>Titulares</dt><dd>{d.owners.map((o) => `${nomeProprio(d.landlords.find((l) => l.id === o.landlord_id)?.name ?? "Proprietário")} ${fmtPct(o.quota / 100, 0)}`).join(" + ")}</dd></div>
      </dl>
    </details>
  </>;
}
