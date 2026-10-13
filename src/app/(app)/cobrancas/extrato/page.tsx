// EXTRATO mês a mês (admin). Era a página Cobranças da V5; passou para aqui no plano de
// clareza (Fase 1), porque responde a "o que se passou com o contrato X no mês Y" e não a
// "quem deve". Os estados são os de todo o lado (monthcell.ts).

import Link from "next/link";
import { redirect } from "next/navigation";
import { Lede } from "@/components/kit/lede";
import { Money } from "@/components/kit/money";
import { OwnerSelection, ScopeFilters, OperationalTable } from "@/components/gestao/operacional";
import { buttonClass } from "@/components/ui";
import { getSession } from "@/lib/data";
import { AMBITO_LABEL } from "@/lib/gestao";
import { monthLabel } from "@/lib/format";
import { operationalData, type OperationalQuery } from "@/lib/portfolio/operacional";

export const dynamic = "force-dynamic";

export default async function Extrato({ searchParams }: { searchParams: Promise<OperationalQuery> }) {
  const [q, { isAdmin }] = await Promise.all([searchParams, getSession()]);
  if (!isAdmin) redirect("/cobrancas");
  const data = await operationalData(q);
  const hidden = { imovel: q.imovel ?? "" };
  if (data.scope === "proprietario" && !data.raw.landlords.some((l) => l.id === q.senhorio)) {
    return <OwnerSelection title="Extrato" q={q} landlords={data.raw.landlords} action="/cobrancas/extrato" hidden={hidden} />;
  }

  const conhecidas = data.rows.filter((r) => r.share !== null);
  const soma = (filtro: (r: (typeof conhecidas)[number]) => boolean, valor: (r: (typeof conhecidas)[number]) => number) =>
    conhecidas.filter(filtro).reduce((n, r) => n + valor(r) * r.share!, 0);
  const totais: Array<[string, number]> = [
    ["Recebido (líquido)", soma(() => true, (r) => r.statement.recorded)],
    ["Em atraso no período", soma((r) => r.statement.status === "atraso", (r) => r.statement.pending)],
    ["Por receber", soma((r) => r.statement.status === "por_receber", (r) => r.statement.pending)],
  ];
  const excluidos = data.rows.length - conhecidas.length;

  return (
    <div className="space-y-6">
      <Link href="/cobrancas" className={buttonClass({ variant: "ghost" })}>Voltar a Cobranças</Link>
      <Lede title="Extrato mês a mês">
        Cada linha é um contrato num mês. Abre um mês para ver os recibos e registar um pagamento recebido sem recibo.
      </Lede>
      <ScopeFilters q={q} landlords={data.raw.landlords} action="/cobrancas/extrato" hidden={hidden} extrato />
      <p className="text-sm text-tinta-2">
        {monthLabel(data.from)} a {monthLabel(data.to)} · {AMBITO_LABEL[data.scope]} · {data.rows.length} meses de contrato
        {excluidos > 0 ? ` · ${excluidos} fora dos totais por quota desconhecida` : ""}
      </p>
      <dl className="grid gap-4 border-y border-regua py-5 sm:grid-cols-3">
        {totais.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-sm text-tinta-2">{rotulo}</dt>
            <dd className="mt-2"><Money value={valor} escala="xl" decimals={2} /></dd>
          </div>
        ))}
      </dl>
      <OperationalTable data={data} q={q} />
      <details className="text-sm text-tinta-2">
        <summary className="cursor-pointer text-acao">Como foram calculados os valores</summary>
        <p className="mt-3 max-w-[72ch] leading-relaxed">
          Um recibo emitido conta como renda paga. Um pagamento registado à mão substitui o recibo do mesmo mês, nunca se
          soma. A renda é ilíquida; o recebido e o valor por pagar são líquidos da retenção na fonte do recibo. O mês em
          curso fica por receber até terminar. Sem recibos da fonte (recibos suspensos ou por importar) o mês fica sem
          informação.
        </p>
      </details>
    </div>
  );
}
