import { ExpenseFormButton } from "@/components/forms";
import { Money } from "@/components/kit";
import { Card } from "@/components/ui";
import { sum } from "@/lib/calc";
import { fmtDate, fmtPct } from "@/lib/format";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/types";
import type { DadosFracao } from "./dados";

export function DespesasFracao({ dados: d }: { dados: DadosFracao }) {
  const properties = [{ id: d.property.id, name: d.rotulo }];
  return <Card title="Despesas" actions={d.isAdmin && <ExpenseFormButton properties={properties} defaultPropertyId={d.property.id} />}>
    <div className="mb-3 flex flex-wrap items-baseline gap-2 text-sm text-tinta-2">
      Últimos 12 meses: <Money value={sum(d.expenses12.map((e) => e.amount))} />
      {d.netYield !== null && <span> · yield líquido {fmtPct(d.netYield, 1)}</span>}
    </div>
    {d.expenses.length === 0 ? <div className="vazio text-sm text-tinta-2">Sem despesas registadas.</div>
      : <ul className="divide-y divide-regua">{d.expenses.map((e) => <li key={e.id} className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-tinta">{EXPENSE_CATEGORY_LABEL[e.category]}</div>
          <div className="break-words text-xs text-tinta-3">{fmtDate(e.expense_date)}{e.description ? " · " + e.description : ""}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Money value={e.amount} decimals={2} />
          {d.isAdmin && <ExpenseFormButton properties={properties} expense={e} />}
        </div>
      </li>)}</ul>}
  </Card>;
}
