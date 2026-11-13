import { Money } from "@/components/kit";
import { Card } from "@/components/ui";
import { fmtDate, monthLabel, nomeProprio } from "@/lib/format";
import type { DadosFracao } from "./dados";
import { LinhaDoTempo } from "./linha-do-tempo";

function RecibosDaFracao({ dados: d }: { dados: DadosFracao }) {
  return <Card title="Recibos do Portal">
    {d.receipts.length === 0 ? <div className="vazio text-sm text-tinta-2">Sem recibos importados.</div>
      : <ul className="divide-y divide-regua">{d.receipts.slice(0, 24).map((r) => <li key={r.id}
        className="flex flex-wrap items-baseline justify-between gap-3 py-2.5 text-sm">
        <span className="font-mono text-xs text-tinta">{monthLabel(r.ref_month)}</span>
        <span className="hidden font-mono text-xs text-tinta-3 sm:inline">{r.receipt_number ?? ""}</span>
        <span className="text-xs text-tinta-3">{fmtDate(r.issue_date)}</span>
        <Money value={r.amount} decimals={2} />
      </li>)}</ul>}
  </Card>;
}

export function PagamentosFracao({ dados: d }: { dados: DadosFracao }) {
  return <div className="space-y-5">
    <details className="rounded-[20px] bg-carta px-4 py-2 text-sm text-tinta-2">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-tinta">Detalhes</summary>
      <p className="pb-3">{d.missingOutside12 > 0 ? <>
        {d.missingOutside12} {d.missingOutside12 === 1 ? "mês em atraso" : "meses em atraso"} antes dos últimos 12 meses
        {d.referenceRent !== null && <> (cerca de <Money value={d.missingOutside12 * d.referenceRent} /> à renda atual)</>}.
      </> : "Nenhum mês em atraso antes dos últimos 12 meses."}
        {d.cessadosOcultos > 0 && <> {d.cessadosOcultos} contratos cessados têm consulta financeira preservada em Rendas.</>}
      </p>
    </details>
    {d.histories.length === 0 ? <div className="vazio text-sm text-tinta-2">Sem contrato ativo.</div>
      : d.histories.map((h) => <Card key={h.contract.id} title={d.histories.length > 1
        ? nomeProprio(h.contract.tenant_name) + " · desde " + fmtDate(h.contract.start_date) : "Ano a ano"}>
        <div className="space-y-4">{h.years.slice().reverse().map((y) =>
          <LinhaDoTempo key={y.year} ano={y.year} meses={y.months} total={y.totalReceived} contractId={h.contract.id} />)}</div>
      </Card>)}
    <RecibosDaFracao dados={d} />
  </div>;
}
