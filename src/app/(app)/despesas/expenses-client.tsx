"use client";

import { useMemo, useState } from "react";
import { ReceiptText } from "lucide-react";
import { DeleteExpenseButton, ExpenseFormButton } from "@/components/forms";
import { Card, EmptyState, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { fmtDate, fmtEur } from "@/lib/format";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/types";

export function ExpensesClient({
  expenses,
  properties,
  landlords,
  isAdmin,
  currentYear,
}: {
  expenses: Expense[];
  properties: Array<{ id: string; name: string }>;
  landlords: Array<{ id: string; name: string }>;
  isAdmin: boolean;
  currentYear: number;
}) {
  const [year, setYear] = useState(String(currentYear));
  const [category, setCategory] = useState("");
  const [propertyId, setPropertyId] = useState("");

  const propertyName = useMemo(() => new Map(properties.map((p) => [p.id, p.name])), [properties]);
  const landlordName = useMemo(() => new Map(landlords.map((l) => [l.id, l.name])), [landlords]);

  const years = useMemo(() => {
    const s = new Set(expenses.map((e) => e.expense_date.slice(0, 4)));
    s.add(String(currentYear));
    return Array.from(s).sort().reverse();
  }, [expenses, currentYear]);

  const filtered = useMemo(
    () =>
      expenses.filter((e) => {
        if (year && e.expense_date.slice(0, 4) !== year) return false;
        if (category && e.category !== category) return false;
        if (propertyId && e.property_id !== propertyId) return false;
        return true;
      }),
    [expenses, year, category, propertyId],
  );

  const byCategory = useMemo(() => {
    const m = new Map<ExpenseCategory, number>();
    for (const e of filtered) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const total = filtered.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Despesas"
        description={`${filtered.length} despesas em ${year} · total ${fmtEur(total)}`}
        actions={isAdmin && <ExpenseFormButton properties={properties} />}
      />

      <div className="flex flex-wrap gap-2">
        {byCategory.map(([cat, v]) => (
          <div key={cat} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-xs">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {EXPENSE_CATEGORY_LABEL[cat]}
            </p>
            <p className="text-sm font-semibold tabular-nums text-zinc-800">{fmtEur(v)}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <Select value={year} onChange={(e) => setYear(e.target.value)} className="max-w-28">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="max-w-40">
            <option value="">Todas as categorias</option>
            {Object.entries(EXPENSE_CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="max-w-56">
            <option value="">Todas as frações</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={ReceiptText}>Sem despesas para os filtros escolhidos.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Fração</Th>
                <Th>Categoria</Th>
                <Th>Descrição</Th>
                <Th className="text-right">Valor</Th>
                {isAdmin && <Th />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50">
                  <Td className="whitespace-nowrap tabular-nums">{fmtDate(e.expense_date)}</Td>
                  <Td className="max-w-52 truncate">
                    {e.property_id
                      ? (propertyName.get(e.property_id) ?? "?")
                      : e.landlord_id
                        ? `Geral · ${landlordName.get(e.landlord_id) ?? "?"}`
                        : "Geral"}
                  </Td>
                  <Td>{EXPENSE_CATEGORY_LABEL[e.category]}</Td>
                  <Td className="max-w-56 truncate">{e.description ?? "n/d"}</Td>
                  <Td className="text-right tabular-nums">{fmtEur(e.amount, 2)}</Td>
                  {isAdmin && (
                    <Td>
                      <div className="flex gap-1">
                        <ExpenseFormButton properties={properties} expense={e} />
                        <DeleteExpenseButton id={e.id} />
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
