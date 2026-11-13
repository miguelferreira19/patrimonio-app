import Link from "next/link";
import { Pilulas } from "@/components/kit";
import { QuotaEvidence } from "@/components/gestao/forms";
import { buttonClass } from "@/components/ui";
import { nomeProprio, fmtPct } from "@/lib/format";
import { tabDaFracao, type DadosFracao } from "./dados";

export const TABS = [
  ["resumo", "Resumo"], ["pagamentos", "Pagamentos"], ["contrato", "Contrato"],
  ["documentos", "Documentos"], ["despesas", "Despesas"],
] as const;

export function NavegacaoFracao({ dados: d, tab, voltar }: { dados: DadosFracao; tab: string; voltar: string }) {
  return <>
    <div className="flex flex-wrap gap-2">
      {[["/rendas?imovel=", "Pagamentos"], ["/manutencao?imovel=", "Manutenção"], ["/vagas?imovel=", "Disponibilidade"]].map(([href, nome]) =>
        <Link key={href} href={href + d.property.id} className={buttonClass({ variant: "outline" })}>{nome}</Link>)}
    </div>
    {d.isAdmin && <QuotaEvidence property={d.property} owners={d.owners.map((o) => ({
      id: o.landlord_id,
      label: nomeProprio(d.landlords.find((l) => l.id === o.landlord_id)?.name ?? "Proprietário") + " · " + fmtPct(o.quota / 100, 0),
      confirmed: o.quota_confirmed === true,
    }))} />}
    <div role="group" aria-label="Secções da fração">
      <Pilulas ativo={tab} itens={TABS.map(([id, rotulo]) => ({
        id, rotulo, n: id === "documentos" && d.docsDaFracao.length > 0 ? d.docsDaFracao.length : undefined,
        href: tabDaFracao(d.property.id, id, voltar),
      }))} />
    </div>
  </>;
}
