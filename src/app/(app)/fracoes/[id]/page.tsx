import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, FileText, Home, Minus, ReceiptText, TrendingUp, X } from "lucide-react";
import {
  ContractFormButton,
  DeleteContractButton,
  DeletePropertyButton,
  EndContractButton,
  ExpenseFormButton,
  PropertyFormButton,
  RentUpdateButton,
} from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { contractActiveInMonth, geoOptionsFromBenchmarks, marketView, sum } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { fmtDate, fmtEur, fmtNum, fmtPct, lastMonthsKeys, monthLabel } from "@/lib/format";
import type {
  Contract,
  Expense,
  Landlord,
  MarketBenchmark,
  Payment,
  Property,
  PropertyOwner,
  Receipt,
  RentUpdate,
} from "@/lib/types";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/types";
import { DeviationBadge } from "../properties-table";

export const dynamic = "force-dynamic";

export default async function FracaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isAdmin } = await getSession();

  const [propQ, ownersQ, landlordsQ, contractsQ, benchQ] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase.from("property_owners").select("*").eq("property_id", id),
    supabase.from("landlords").select("*").order("name"),
    supabase.from("contracts").select("*").eq("property_id", id).order("start_date", { ascending: false }),
    supabase.from("market_benchmarks").select("*"),
  ]);

  const property = propQ.data as Property | null;
  if (!property) notFound();

  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const landlords = (landlordsQ.data ?? []) as Landlord[];
  const contracts = (contractsQ.data ?? []) as Contract[];
  const benchmarks = (benchQ.data ?? []) as MarketBenchmark[];
  const geoOptions = geoOptionsFromBenchmarks(benchmarks);

  const contractIds = contracts.map((c) => c.id);
  const [paymentsQ, receiptsQ, expensesQ, updatesQ] = await Promise.all([
    contractIds.length > 0
      ? supabase.from("payments").select("*").in("contract_id", contractIds)
      : Promise.resolve({ data: [] as Payment[] }),
    supabase
      .from("receipts")
      .select("*")
      .eq("property_id", id)
      .order("ref_month", { ascending: false })
      .limit(24),
    supabase
      .from("expenses")
      .select("*")
      .eq("property_id", id)
      .order("expense_date", { ascending: false })
      .limit(50),
    contractIds.length > 0
      ? supabase
          .from("rent_updates")
          .select("*")
          .in("contract_id", contractIds)
          .order("effective_date", { ascending: false })
      : Promise.resolve({ data: [] as RentUpdate[] }),
  ]);

  const payments = (paymentsQ.data ?? []) as Payment[];
  const receipts = (receiptsQ.data ?? []) as Receipt[];
  const expenses = (expensesQ.data ?? []) as Expense[];
  const rentUpdates = (updatesQ.data ?? []) as RentUpdate[];

  const active = contracts.find((c) => c.status === "ativo");
  const mv = marketView(property, active, benchmarks);
  const landlordById = new Map(landlords.map((l) => [l.id, l]));

  const months = lastMonthsKeys(12);
  const payByMonth = new Map(payments.map((p) => [`${p.contract_id}:${p.ref_month.slice(0, 7)}`, p]));

  const expenses12 = expenses.filter((e) => e.expense_date >= months[0]);
  const rent12 = active ? active.rent * 12 : 0;
  const netYield =
    mv.estimatedValue && active ? (rent12 - sum(expenses12.map((e) => e.amount))) / mv.estimatedValue : null;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div>
        <p className="text-xs text-zinc-500">
          <Link href="/fracoes" className="hover:text-teal-700 hover:underline">
            Frações
          </Link>
          <span className="mx-1.5 text-zinc-300">/</span>
          {property.name}
        </p>
        <PageHeader
          className="mt-1"
          title={property.name}
          description={
            [property.address, property.parish, property.municipality].filter(Boolean).join(" · ") ||
            "Sem morada"
          }
          actions={
            isAdmin && (
              <div className="flex flex-wrap gap-2">
                <PropertyFormButton
                  landlords={landlords}
                  geoOptions={geoOptions}
                  property={property}
                  owners={owners}
                  small
                />
                <DeletePropertyButton id={property.id} />
              </div>
            )
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {property.status === "arrendado" ? (
            <Badge tone="green">Arrendado</Badge>
          ) : property.status === "vago" ? (
            <Badge tone="amber">Vago</Badge>
          ) : (
            <Badge tone="zinc">Outro</Badge>
          )}
          {property.typology && <Badge tone="zinc">{property.typology}</Badge>}
          {property.area_m2 && <Badge tone="zinc">{fmtNum(property.area_m2, 0)} m²</Badge>}
          <span className="text-xs text-zinc-500">
            Senhorios:{" "}
            {owners
              .map((o) => `${landlordById.get(o.landlord_id)?.name ?? "?"} (${fmtNum(o.quota, 0)}%)`)
              .join(" + ") || "n/d"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Contrato ativo */}
        <Card
          title="Contrato ativo"
          actions={
            isAdmin && (
              <div className="flex flex-wrap gap-2">
                {active && <RentUpdateButton contract={{ id: active.id, rent: active.rent }} />}
                {active && <ContractFormButton propertyId={property.id} contract={active} />}
                {active && <EndContractButton contractId={active.id} />}
                {!active && <ContractFormButton propertyId={property.id} />}
              </div>
            )
          }
        >
          {active ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Inquilino</dt>
                <dd className="font-medium">{active.tenant_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Renda mensal</dt>
                <dd className="font-semibold tabular-nums text-teal-700">{fmtEur(active.rent, 2)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Início</dt>
                <dd className="tabular-nums">{fmtDate(active.start_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Vencimento</dt>
                <dd className="tabular-nums">dia {active.due_day}</dd>
              </div>
              {active.pf_contract_no && (
                <div>
                  <dt className="text-xs text-zinc-500">Contrato Portal Finanças</dt>
                  <dd className="font-mono text-xs">{active.pf_contract_no}</dd>
                </div>
              )}
              {active.tenant_nif && (
                <div>
                  <dt className="text-xs text-zinc-500">NIF inquilino</dt>
                  <dd className="font-mono text-xs">{active.tenant_nif}</dd>
                </div>
              )}
            </dl>
          ) : (
            <EmptyState icon={Home}>Sem contrato ativo. Fração vaga.</EmptyState>
          )}
        </Card>

        {/* Mercado e valor */}
        <Card title="Mercado e valor" subtitle={mv.benchmark ? `INE ${mv.benchmark.period} · ${mv.benchmark.level === "concelho" ? "mediana do concelho" : "mediana da freguesia"}` : undefined}>
          {mv.benchmark ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Renda atual €/m²</dt>
                <dd className="font-medium tabular-nums">
                  {mv.rentPerM2 !== null ? `${fmtNum(mv.rentPerM2, 2)} €` : "n/d"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Mediana mercado €/m²</dt>
                <dd className="font-medium tabular-nums">
                  {mv.benchmarkRentM2 !== null ? `${fmtNum(mv.benchmarkRentM2, 2)} €` : "n/d"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Desvio vs. mercado</dt>
                <dd><DeviationBadge deviation={mv.deviation} /></dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Potencial por mês</dt>
                <dd className="font-medium text-amber-700 tabular-nums">
                  {mv.gapEurMonth ? `+${fmtEur(mv.gapEurMonth)}` : "n/d"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Valor estimado (mediana venda)</dt>
                <dd className="font-semibold tabular-nums">{fmtEur(mv.estimatedValue)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">VPT</dt>
                <dd className="tabular-nums">
                  {fmtEur(property.vpt)} {property.vpt_year ? `(${property.vpt_year})` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Yield bruto</dt>
                <dd className="tabular-nums">{fmtPct(mv.grossYield, 1)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Yield líquido (12m)</dt>
                <dd className="tabular-nums">{fmtPct(netYield, 1)}</dd>
              </div>
            </dl>
          ) : (
            <EmptyState icon={TrendingUp}>
              Sem benchmark para esta freguesia. Preenche o DICOFRE da fração e importa os dados do
              INE na página Admin.
            </EmptyState>
          )}
          <p className="mt-3 text-[11px] leading-snug text-zinc-400">
            Estimativas com base nas medianas do INE por freguesia (rendas de novos contratos e
            valores de venda): são ordens de grandeza, não avaliações imobiliárias.
          </p>
        </Card>
      </div>

      {/* Pagamentos últimos 12 meses */}
      <Card title="Pagamentos · últimos 12 meses" subtitle="Marca os pagamentos na página Pagamentos">
        {active || contracts.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {months.map((m) => {
              const c = contracts.find((cc) => contractActiveInMonth(cc, m));
              const pay = c ? payByMonth.get(`${c.id}:${m.slice(0, 7)}`) : undefined;
              const state = !c ? "na" : pay ? "pago" : "falta";
              return (
                <div
                  key={m}
                  title={
                    pay
                      ? `${fmtEur(pay.amount, 2)} · ${fmtDate(pay.received_date)}`
                      : state === "falta"
                        ? "Renda em falta"
                        : undefined
                  }
                  className={
                    "flex h-14 w-16 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] " +
                    (state === "pago"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : state === "falta"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-400")
                  }
                >
                  <span className="font-mono font-medium">{monthLabel(m, false)}</span>
                  {state === "pago" ? (
                    <Check size={14} strokeWidth={2.5} aria-label="Pago" />
                  ) : state === "falta" ? (
                    <X size={14} strokeWidth={2.5} aria-label="Em falta" />
                  ) : (
                    <Minus size={14} strokeWidth={2.5} className="text-zinc-300" aria-label="Sem contrato" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={Home}>Sem contratos nesta fração.</EmptyState>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Despesas */}
        <Card
          title="Despesas recentes"
          subtitle={`Últimos 12 meses: ${fmtEur(sum(expenses12.map((e) => e.amount)))}`}
          actions={isAdmin && <ExpenseFormButton properties={[{ id: property.id, name: property.name }]} defaultPropertyId={property.id} />}
        >
          {expenses.length === 0 ? (
            <EmptyState icon={ReceiptText}>Sem despesas registadas.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Categoria</Th>
                  <Th>Descrição</Th>
                  <Th className="text-right">Valor</Th>
                  {isAdmin && <Th />}
                </tr>
              </thead>
              <tbody>
                {expenses.slice(0, 12).map((e) => (
                  <tr key={e.id} className="hover:bg-zinc-50">
                    <Td className="whitespace-nowrap tabular-nums">{fmtDate(e.expense_date)}</Td>
                    <Td>{EXPENSE_CATEGORY_LABEL[e.category]}</Td>
                    <Td className="max-w-44 truncate">{e.description ?? "n/d"}</Td>
                    <Td className="text-right tabular-nums">{fmtEur(e.amount, 2)}</Td>
                    {isAdmin && (
                      <Td>
                        <ExpenseFormButton
                          properties={[{ id: property.id, name: property.name }]}
                          expense={e}
                        />
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Recibos */}
        <Card title="Recibos (Portal das Finanças)" subtitle="Importados na página Admin">
          {receipts.length === 0 ? (
            <EmptyState icon={FileText}>Sem recibos importados para esta fração.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Mês</Th>
                  <Th>Nº recibo</Th>
                  <Th>Emitido</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {receipts.slice(0, 12).map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <Td className="font-mono">{monthLabel(r.ref_month)}</Td>
                    <Td className="font-mono">{r.receipt_number ?? "n/d"}</Td>
                    <Td className="tabular-nums">{fmtDate(r.issue_date)}</Td>
                    <Td className="text-right tabular-nums">{fmtEur(r.amount, 2)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {/* Histórico de contratos e rendas */}
      <Card title="Histórico de contratos e atualizações de renda">
        {contracts.length === 0 ? (
          <EmptyState icon={Home}>Sem contratos.</EmptyState>
        ) : (
          <div className="space-y-3">
            <Table>
              <thead>
                <tr>
                  <Th>Inquilino</Th>
                  <Th>Início</Th>
                  <Th>Fim</Th>
                  <Th className="text-right">Renda</Th>
                  <Th>Estado</Th>
                  {isAdmin && <Th />}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <Td>{c.tenant_name}</Td>
                    <Td className="tabular-nums">{fmtDate(c.start_date)}</Td>
                    <Td className="tabular-nums">{fmtDate(c.end_date)}</Td>
                    <Td className="text-right tabular-nums">{fmtEur(c.rent, 2)}</Td>
                    <Td>
                      {c.status === "ativo" ? (
                        <Badge tone="green">Ativo</Badge>
                      ) : (
                        <Badge tone="zinc">Cessado</Badge>
                      )}
                    </Td>
                    {isAdmin && (
                      <Td>
                        <div className="flex gap-1">
                          <ContractFormButton propertyId={property.id} contract={c} label="Editar" />
                          <DeleteContractButton id={c.id} />
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
            {rentUpdates.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Atualizações de renda
                </p>
                <ul className="space-y-1 text-sm text-zinc-600">
                  {rentUpdates.map((u) => (
                    <li key={u.id} className="tabular-nums">
                      {fmtDate(u.effective_date)}: {fmtEur(u.old_rent, 2)} → {fmtEur(u.new_rent, 2)}{" "}
                      <span className="text-xs text-zinc-400">({u.reason})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
