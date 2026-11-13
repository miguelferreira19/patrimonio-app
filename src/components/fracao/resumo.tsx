import Link from "next/link";
import { ContractFormButton, RentUpdateButton } from "@/components/forms";
import { ListaDocumentos } from "@/components/documentos/lista";
import { DeviationBadge, Money } from "@/components/kit";
import { Card, buttonClass } from "@/components/ui";
import { fmtDate, fmtPct, monthLabel, nomeProprio } from "@/lib/format";
import { classifyUso } from "@/lib/irs";
import { chaveDoInquilino } from "@/lib/portfolio/inquilinos";
import { tabDaFracao, type DadosFracao } from "./dados";
import { LinhaDoTempo } from "./linha-do-tempo";

function Facto({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-tinta-3">{rotulo}</dt><dd className="mt-0.5 font-medium text-tinta">{children}</dd></div>;
}

function PagamentosRecentes({ dados: d, voltar }: { dados: DadosFracao; voltar: string }) {
  return <Card title="Pagamentos" actions={d.historiaAtiva && <Link
    href={tabDaFracao(d.property.id, "pagamentos", voltar)} className="inline-flex min-h-11 items-center text-sm font-semibold">Histórico completo</Link>}>
    {d.ultimosAnos.length === 0 ? <div className="vazio text-sm text-tinta-2">{d.active ? "Ainda sem pagamentos registados." : "Sem contrato ativo."}</div>
      : <div className="space-y-4">{d.ultimosAnos.map((y) => <LinhaDoTempo key={y.year} ano={y.year} meses={y.months}
        total={y.totalReceived} contractId={d.historiaAtiva!.contract.id} />)}</div>}
  </Card>;
}

function ContratoAtual({ dados: d }: { dados: DadosFracao }) {
  const c = d.active;
  return <Card title="Contrato">
    {c ? <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
      <Facto rotulo="Inquilino"><Link href={"/inquilinos/" + encodeURIComponent(chaveDoInquilino(c))}
        className="inline-flex min-h-11 items-center">{nomeProprio(c.tenant_name)}</Link></Facto>
      <Facto rotulo="Renda"><Money value={c.rent} decimals={2} escala="lg" /></Facto>
      <Facto rotulo="Desde">{fmtDate(c.start_date)}</Facto>
      <Facto rotulo="Vence">dia {c.due_day}</Facto>
      {c.pf_contract_no && <Facto rotulo="Contrato no Portal"><span className="font-mono text-xs">{c.pf_contract_no}</span></Facto>}
      <Facto rotulo="Fim">{c.end_date ? fmtDate(c.end_date) : <span className="text-tinta-2">Sem data na base</span>}</Facto>
    </dl> : <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="vazio text-sm text-tinta-2">Fração sem contrato ativo.</div>
      {d.isAdmin && <ContractFormButton propertyId={d.property.id} />}
    </div>}
  </Card>;
}

function ProximoPasso({ dados: d }: { dados: DadosFracao }) {
  if (!d.active || (!d.sobe && d.emFalta12 === 0)) return null;
  return <Card title={d.sobe ? "A renda pode subir" : d.emFalta12 + (d.emFalta12 === 1 ? " mês em atraso" : " meses em atraso")}>
    {d.sobe ? <>
      <div className="mb-3 flex flex-wrap items-baseline gap-2 text-sm">
        <Money value={d.active.rent} decimals={2} /> para <Money value={d.sobe.suggestedRent} decimals={2} />
        <span>desde {monthLabel(d.sobe.eligibleSince!)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={"/api/minuta/renda/" + d.active.id} className={buttonClass({ size: "sm" })}>Carta em Word</a>
        {d.isAdmin && <RentUpdateButton contract={{ id: d.active.id, rent: d.active.rent }} suggestedRent={d.sobe.suggestedRent ?? undefined} />}
      </div>
      <details className="mt-3 text-sm text-tinta-2"><summary className="flex min-h-11 cursor-pointer items-center">Detalhes</summary>
        <p>A carta tem de chegar 30 dias antes de a nova renda valer.</p>
      </details>
    </> : <>
      <a href={"/api/minuta/interpelacao/" + d.active.id} className={buttonClass({ size: "sm" })}>Interpelação em Word</a>
      <details className="mt-3 text-sm text-tinta-2"><summary className="flex min-h-11 cursor-pointer items-center">Detalhes</summary>
        <p>Nos últimos 12 meses. A interpelação é a carta que antecede qualquer passo formal.</p>
      </details>
    </>}
  </Card>;
}

function Mercado({ dados: d }: { dados: DadosFracao }) {
  return <Card title="Mercado">
    {d.mv.benchmark ? <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      <Facto rotulo="Renda/m²"><Money value={d.mv.rentPerM2} decimals={2} /></Facto>
      <Facto rotulo={"Mediana INE " + d.mv.benchmark.period}><Money value={d.mv.benchmarkRentM2} decimals={2} /></Facto>
      <Facto rotulo="Diferença"><DeviationBadge deviation={d.mv.deviation} /></Facto>
      <Facto rotulo="Yield bruto">{fmtPct(d.mv.grossYield, 1)}</Facto>
      <Facto rotulo="Valor estimado"><Money value={d.mv.estimatedValue} /></Facto>
      <Facto rotulo="VPT"><Money value={d.property.vpt} /></Facto>
    </dl> : <details className="text-sm text-tinta-2">
      <summary className="flex min-h-11 cursor-pointer items-center">Detalhes</summary>
      <p>{!d.property.dicofre ? "Sem freguesia na ficha: não há mediana do INE para comparar."
        : classifyUso(d.property.typology) !== "habitacao" ? "Sem comparação: as medianas do INE são de habitação."
        : !d.property.area_m2 ? "Sem área na ficha, por isso não há €/m²." : "Sem medianas do INE para este concelho."}</p>
    </details>}
  </Card>;
}

function DocumentosRecentes({ dados: d, voltar }: { dados: DadosFracao; voltar: string }) {
  return <Card title="Documentos" actions={<Link href={tabDaFracao(d.property.id, "documentos", voltar)}
    className="inline-flex min-h-11 items-center text-sm font-semibold">Todos</Link>}>
    {d.docsDaFracao.length === 0 ? <div className="vazio text-sm text-tinta-2">Nada arquivado.</div>
      : <ListaDocumentos docs={d.docsDaFracao.slice(0, 3)} isAdmin={false} />}
  </Card>;
}

export function ResumoFracao({ dados, voltar }: { dados: DadosFracao; voltar: string }) {
  return <div className="space-y-5">
    <PagamentosRecentes dados={dados} voltar={voltar} />
    <ContratoAtual dados={dados} />
    <ProximoPasso dados={dados} />
    <Mercado dados={dados} />
    <DocumentosRecentes dados={dados} voltar={voltar} />
  </div>;
}
