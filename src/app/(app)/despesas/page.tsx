import Link from "next/link";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { getManagement } from "@/lib/portfolio/gestao-load";
import { operationalPeriod, type OperationalQuery } from "@/lib/portfolio/operacional";
import { quotasDeclarantes, scopedExpense, AMBITO_LABEL, type Ambito } from "@/lib/gestao";
import { getSession } from "@/lib/data";
import { Lede } from "@/components/kit/lede";
import { Money } from "@/components/kit/money";
import { OwnerSelection, ScopeFilters } from "@/components/gestao/operacional";
import { ExpenseAssociation } from "@/components/gestao/forms";
import { ExpenseFormButton, DeleteExpenseButton } from "@/components/forms";
import { Card, buttonClass } from "@/components/ui";
import { fmtDate, endOfMonthISO } from "@/lib/format";
import { nomeDaFracao } from "@/lib/portfolio/predios";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<OperationalQuery & { imovel?: string }>;
}) {
  const q = await searchParams;
  const [{ raw }, m, { isAdmin }] = await Promise.all([getSnapshotComRaw(), getManagement(), getSession()]);
  const period = operationalPeriod(q);
  const scope: Ambito = ["carteira", "proprietario"].includes(q.ambito ?? "")
    ? (q.ambito as Ambito)
    : "inteiro";
  if (scope === "proprietario" && !raw.landlords.some((l) => l.id === q.senhorio))
    return (
      <OwnerSelection
        title="Despesas"
        q={q}
        landlords={raw.landlords}
        action="/despesas"
        hidden={{ imovel: q.imovel ?? "" }}
      />
    );
  const declarantes = quotasDeclarantes(raw.expenses, raw.owners);
  const expenses = raw.expenses
    .filter(
      (e) =>
        e.expense_date >= period.from &&
        e.expense_date <= endOfMonthISO(period.to) &&
        (!q.imovel || e.property_id === q.imovel) &&
        (!q.q ||
          `${e.description} ${e.category} ${raw.properties.find((p) => p.id === e.property_id)?.name}`
            .toLowerCase()
            .includes(q.q.toLowerCase())),
    )
    .map((e) => ({
      expense: e,
      ...scopedExpense(e, raw.owners, raw.landlords, scope, q.senhorio, declarantes),
    }))
    .filter((e) => scope !== "proprietario" || e.amount !== null);
  const total = expenses.reduce((n, e) => n + (e.amount ?? 0), 0);
  const properties = raw.properties.map((p) => ({ id: p.id, name: nomeDaFracao(p) }));
  return (
    <div className="space-y-6">
      <Lede
        title="Despesas"
        actions={isAdmin && <ExpenseFormButton properties={properties} defaultPropertyId={q.imovel} />}
      >
        Consulta os custos realizados e associa faturas às intervenções existentes.
      </Lede>
      <ScopeFilters
        q={q}
        landlords={raw.landlords}
        action="/despesas"
        hidden={{ imovel: q.imovel ?? "" }}
        ambito={false}
      />
      <p className="text-sm text-tinta-2">
        {period.from.slice(0, 7)} a {period.to.slice(0, 7)} · {AMBITO_LABEL[scope]} · {expenses.length}{" "}
        despesas{q.imovel ? " · imóvel selecionado" : ""}
      </p>
      <div className="border-y border-regua py-5">
        <p className="text-sm text-tinta-2">
          Custos do período · {expenses.some((e) => e.estimated) ? "inclui valores estimados" : "registados"}
        </p>
        <div className="mt-2">
          <Money value={total} escala="xl" decimals={2} />
        </div>
        {expenses.some((e) => e.amount === null) && (
          <p className="mt-2 text-xs text-tinta-2">
            As despesas com quota desconhecida estão excluídas do total.
          </p>
        )}
      </div>
      <div className="space-y-4">
        {expenses.map(({ expense: e, amount, estimated }) => (
          <Card
            key={e.id}
            title={e.description || e.category}
            subtitle={`${fmtDate(e.expense_date)} · ${properties.find((p) => p.id === e.property_id)?.name || "Despesa geral"}`}
          >
            <div className="flex flex-wrap justify-between gap-3">
              <p className="text-sm text-tinta-2">
                {e.category} · {estimated ? "estimativa / valor reconstruído pela quota" : "valor registado"}
                {e.landlord_id
                  ? ` · titular ${raw.landlords.find((l) => l.id === e.landlord_id)?.name}`
                  : " · custo do imóvel por inteiro"}
              </p>
              <Money value={amount} decimals={2} />
            </div>
            {e.case_id && (
              <Link
                href={`/gestao/${e.case_id}`}
                className="mt-3 inline-flex min-h-11 items-center text-sm text-acao underline"
              >
                Abrir intervenção associada
              </Link>
            )}
            {isAdmin && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <ExpenseFormButton properties={properties} expense={e} />
                  <DeleteExpenseButton id={e.id} />
                </div>
                {e.property_id && (
                  <ExpenseAssociation
                    expenseId={e.id}
                    selected={e.case_id}
                    cases={m.cases
                      .filter((c) => c.kind === "manutencao" && c.property_id === e.property_id)
                      .map((c) => ({ id: c.id, label: c.title }))}
                  />
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
      {!expenses.length && (
        <p className="py-8 text-sm text-tinta-2">Nenhuma despesa corresponde aos filtros.</p>
      )}
      <details className="text-sm text-tinta-2">
        <summary className="cursor-pointer text-acao">Como foram calculados os valores</summary>
        <p className="mt-3 max-w-[72ch]">
          Uma despesa de um proprietário já representa a sua parte. Para mostrar o imóvel por inteiro, o valor
          é reconstruído apenas quando a quota é conhecida e fica identificado como estimativa. Despesas
          gerais são mostradas como registadas, sem quota imobiliária. Orçamentos de manutenção não entram
          neste total. A data do registo é usada sem redistribuir despesas anuais por meses.
        </p>
      </details>
      <Link href="/relatorios" className={buttonClass({ variant: "outline" })}>
        Consultar relatórios fiscais
      </Link>
    </div>
  );
}
