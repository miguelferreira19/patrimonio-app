import Link from "next/link";
import { ContractFormButton, DeleteContractButton, RentUpdateButton } from "@/components/forms";
import { Money } from "@/components/kit";
import { Badge, Card, buttonClass } from "@/components/ui";
import { fmtDate, nomeProprio } from "@/lib/format";
import { chaveDoInquilino } from "@/lib/portfolio/inquilinos";
import type { DadosFracao } from "./dados";

function ContratosDaFracao({ dados: d }: { dados: DadosFracao }) {
  return <Card title="Contratos desta fração">
    {d.contracts.length === 0 ? <div className="vazio text-sm text-tinta-2">Sem contratos.</div>
      : <ul className="divide-y divide-regua">{d.contracts.map((c) => <li key={c.id}
        className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <Link href={"/inquilinos/" + encodeURIComponent(chaveDoInquilino(c))}
            className="inline-flex min-h-11 items-center font-medium text-tinta">{nomeProprio(c.tenant_name)}</Link>
          <div className="text-xs text-tinta-3">{fmtDate(c.start_date)} a {c.end_date ? fmtDate(c.end_date) : "hoje"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Money value={c.rent} decimals={2} />
          <Badge tone="neutro">{c.status === "ativo" ? "Ativo" : "Terminado"}</Badge>
          {d.isAdmin && <ContractFormButton propertyId={d.property.id} contract={c} label="Editar" />}
          {d.isAdmin && <DeleteContractButton id={c.id} />}
        </div>
      </li>)}</ul>}
  </Card>;
}

function AtualizacoesEVagas({ dados: d }: { dados: DadosFracao }) {
  return <>
    {d.rentUpdates.length > 0 && <Card title="Atualizações de renda">
      <ul className="space-y-1.5 text-sm text-tinta-2">{d.rentUpdates.map((u) => <li key={u.id}>
        {fmtDate(u.effective_date)}: <Money value={u.old_rent} decimals={2} /> para <Money value={u.new_rent} decimals={2} />{" "}
        <span className="text-xs text-tinta-3">({u.reason})</span>
      </li>)}</ul>
    </Card>}
    {d.gaps.length > 0 && <Card title="Períodos sem inquilino">
      <ul className="space-y-1.5 text-sm text-tinta-2">{d.gaps.map((g) => <li key={g.gapStart}>
        {fmtDate(g.gapStart)} a {g.gapEnd ? fmtDate(g.gapEnd) : "hoje"}{" "}
        <span className="text-xs text-tinta-3">({g.days} dias, cerca de <Money value={g.lostRent} /> perdidos)</span>
      </li>)}</ul>
    </Card>}
  </>;
}

export function ContratoFracao({ dados: d }: { dados: DadosFracao }) {
  return <div className="space-y-5">
    {d.active && d.isAdmin && <div className="flex flex-wrap gap-2">
      <ContractFormButton propertyId={d.property.id} contract={d.active} label="Editar contrato" />
      <RentUpdateButton contract={{ id: d.active.id, rent: d.active.rent }} suggestedRent={d.sobe?.suggestedRent ?? undefined} />
      <Link href={"/arquivo?fracao=" + d.property.id} className={buttonClass({ variant: "outline", size: "sm" })}>Cartas e minutas</Link>
    </div>}
    <ContratosDaFracao dados={d} />
    <AtualizacoesEVagas dados={d} />
  </div>;
}
