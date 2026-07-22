"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Search,
  Wallet,
} from "lucide-react";
import { ArrearsFlowChart } from "@/components/charts";
import { Badge, Card, cn, EmptyState, Input, Select, StatCard, Table, Td, Th } from "@/components/ui";
import { fmtEur, monthLabel } from "@/lib/format";
import {
  SEVERITY_LABEL,
  SEVERITY_RANK,
  type ArrearsMonthCell,
  type ArrearsRow,
  type ArrearsSeverity,
  type ArrearsSummary,
} from "@/lib/arrears";

/** ArrearsRow (cálculo puro) + o que só o server consegue resolver por join (nomes). */
export interface ArrearsViewRow extends ArrearsRow {
  propertyName: string;
  matrizArticle: string | null;
  landlordIds: string[];
  landlordNames: string[];
}

const SEVERITY_BADGE_TONE: Record<ArrearsSeverity, "green" | "red" | "amber"> = {
  ok: "green",
  atencao: "amber",
  atraso: "red",
  critico: "red",
  ritmo_proprio: "amber",
};

function SeverityBadge({ severity }: { severity: ArrearsSeverity }) {
  return <Badge tone={SEVERITY_BADGE_TONE[severity]}>{SEVERITY_LABEL[severity]}</Badge>;
}

const CELL_TONE: Record<ArrearsMonthCell["status"], string> = {
  pago: "bg-emerald-50 text-emerald-700",
  parcial: "bg-amber-50 text-amber-700",
  falta: "bg-red-50 text-red-700",
  antes_inicio: "bg-zinc-100 text-zinc-400",
};

function monthCellTitle(cell: ArrearsMonthCell): string {
  const label = monthLabel(cell.month);
  switch (cell.status) {
    case "antes_inicio":
      return `${label}: antes do início do contrato`;
    case "pago":
      return `${label}: pago (${fmtEur(cell.paid, 2)})`;
    case "parcial":
      return `${label}: parcial, faltam ${fmtEur(cell.deficit, 2)}`;
    default:
      return `${label}: em falta`;
  }
}

/** Grelha dos últimos 24 meses devidos de um contrato — conteúdo da linha expansível. */
function MonthsGrid({ months }: { months: ArrearsMonthCell[] }) {
  return (
    <div className="py-1">
      <div className="flex flex-wrap gap-1">
        {months.map((cell) => (
          <div
            key={cell.month}
            title={monthCellTitle(cell)}
            className={cn(
              "flex h-10 w-16 flex-col items-center justify-center gap-0.5 rounded font-mono text-[10px] leading-tight",
              CELL_TONE[cell.status],
            )}
          >
            <span>{monthLabel(cell.month, false)}</span>
            {cell.status === "parcial" && <span className="tabular-nums">-{fmtEur(cell.deficit, 0)}</span>}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-emerald-400" aria-hidden="true" />
          Pago
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-amber-400" aria-hidden="true" />
          Parcial
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-red-400" aria-hidden="true" />
          Em falta
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-zinc-300" aria-hidden="true" />
          Antes do contrato
        </span>
      </div>
    </div>
  );
}

const TABLE_COLS = 10;

/** Renda contratada e, por baixo, o que o contrato realmente recebe por mês quando os dois
 *  valores divergem (retenção na fonte na origem, ou renda atualizada sem recibos novos).
 *  O desvio é mostrado como facto, não somado à dívida — ver referenceRent() em arrears.ts. */
function RentCell({ rent, expectedRent }: { rent: number; expectedRent: number }) {
  if (expectedRent >= rent - 1) return <>{fmtEur(rent)}</>;
  return (
    <>
      {fmtEur(rent)}
      <span className="block text-xs text-zinc-400">recebe {fmtEur(expectedRent)}</span>
    </>
  );
}

export function ArrearsClient({
  rows,
  landlords,
  summary,
}: {
  rows: ArrearsViewRow[];
  landlords: Array<{ id: string; name: string }>;
  summary: ArrearsSummary;
}) {
  const [landlordId, setLandlordId] = useState("");
  const [severity, setSeverity] = useState<ArrearsSeverity | "">("");
  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (landlordId && !r.landlordIds.includes(landlordId)) return false;
        if (severity && r.severity !== severity) return false;
        if (needle) {
          const hay = `${r.tenantName} ${r.propertyName} ${r.matrizArticle ?? ""}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.streak - a.streak);
  }, [rows, landlordId, severity, q]);

  const worstRow = useMemo(
    () => (summary.worst ? rows.find((r) => r.contractId === summary.worst!.contractId) : undefined),
    [rows, summary.worst],
  );

  const chartData = useMemo(
    () =>
      summary.monthly.map((m) => ({
        label: monthLabel(m.month, m.month.slice(5, 7) === "01"),
        esperado: m.esperado,
        recebido: m.recebido,
      })),
    [summary.monthly],
  );

  const nothingInArrears = summary.contractsInArrears === 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Contratos em atraso"
          value={summary.contractsInArrears}
          tone={nothingInArrears ? "green" : "red"}
          icon={AlertTriangle}
        />
        <StatCard
          label="Renda mensal em risco"
          value={fmtEur(summary.rentAtRisk)}
          sub="valor que os contratos em atraso costumam receber"
          tone={nothingInArrears ? "green" : "amber"}
          icon={Wallet}
        />
        <StatCard
          label="Dívida estimada"
          value={fmtEur(summary.totalDebt)}
          sub="cap de 24 meses por contrato"
          tone={nothingInArrears ? "green" : "red"}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Maior atraso"
          value={summary.worst ? `${summary.worst.streak} meses` : "0 meses"}
          sub={worstRow ? `${worstRow.tenantName} · ${worstRow.propertyName}` : "Sem contratos em atraso"}
          tone={nothingInArrears ? "green" : "red"}
          icon={CalendarClock}
        />
      </div>

      <Card
        title="Esperado vs. recebido (12 meses fechados)"
        subtitle="Esperado = rendas dos contratos já em vigor em cada mês, no valor que costumam receber (líquido de retenção na fonte). O mês corrente fica de fora — tem sempre recibos por emitir."
      >
        <ArrearsFlowChart data={chartData} />
      </Card>

      <Card>
        {nothingInArrears ? (
          <EmptyState icon={CheckCircle2}>
            <strong className="text-zinc-700">Tudo em dia.</strong>{" "}
            {rows.length === 0
              ? "Não há contratos ativos para analisar."
              : "Nenhum contrato ativo tem rendas em atraso neste momento."}
          </EmptyState>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Select
                value={landlordId}
                onChange={(e) => setLandlordId(e.target.value)}
                className="w-full sm:w-auto sm:max-w-44"
              >
                <option value="">Todos os senhorios</option>
                {landlords.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
              <Select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as ArrearsSeverity | "")}
                className="w-full sm:w-auto sm:max-w-44"
              >
                <option value="">Todas as gravidades</option>
                <option value="critico">Crítico</option>
                <option value="atraso">Atraso</option>
                <option value="atencao">Atenção</option>
                <option value="ritmo_proprio">Ritmo próprio</option>
                <option value="ok">Em dia</option>
              </Select>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Procurar por inquilino ou fração…"
                className="w-full sm:max-w-xs"
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={Search}>Sem contratos para os filtros escolhidos.</EmptyState>
            ) : (
              <>
                {/* Desktop/tablet: tabela com cabeçalho fixo ao fazer scroll vertical. */}
                <div className="hidden md:block">
                  <Table>
                    <thead>
                      <tr>
                        <Th className="sticky top-0 z-10 w-8 bg-white" />
                        <Th className="sticky top-0 z-10 bg-white">Fração</Th>
                        <Th className="sticky top-0 z-10 bg-white">Inquilino</Th>
                        <Th className="sticky top-0 z-10 bg-white">Senhorio(s)</Th>
                        <Th className="sticky top-0 z-10 bg-white text-right">Renda</Th>
                        <Th className="sticky top-0 z-10 bg-white">Último mês pago</Th>
                        <Th className="sticky top-0 z-10 bg-white text-right">Meses em atraso</Th>
                        <Th className="sticky top-0 z-10 bg-white text-right">Em falta (12m)</Th>
                        <Th className="sticky top-0 z-10 bg-white text-right">Dívida estimada</Th>
                        <Th className="sticky top-0 z-10 bg-white">Estado</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row) => {
                        const isOpen = expandedId === row.contractId;
                        return (
                          <Fragment key={row.contractId}>
                            <tr
                              onClick={() => setExpandedId(isOpen ? null : row.contractId)}
                              className="cursor-pointer hover:bg-zinc-50"
                            >
                              <Td className="pr-0">
                                <button
                                  type="button"
                                  aria-label={isOpen ? "Recolher detalhe mensal" : "Expandir detalhe mensal"}
                                  aria-expanded={isOpen}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedId(isOpen ? null : row.contractId);
                                  }}
                                  className="rounded p-0.5 text-zinc-400 transition-colors duration-150 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                                >
                                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                              </Td>
                              <Td>
                                <Link
                                  href={`/fracoes/${row.propertyId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="block max-w-40 truncate font-medium text-teal-700 hover:underline"
                                >
                                  {row.propertyName}
                                </Link>
                                {row.matrizArticle && (
                                  <p className="font-mono text-xs text-zinc-400">{row.matrizArticle}</p>
                                )}
                              </Td>
                              <Td className="max-w-40 truncate">{row.tenantName}</Td>
                              <Td className="max-w-32 truncate">{row.landlordNames.join(", ") || "n/d"}</Td>
                              <Td className="text-right tabular-nums">
                                <RentCell rent={row.rent} expectedRent={row.expectedRent} />
                              </Td>
                              <Td className="font-mono text-xs tabular-nums">
                                {row.lastPaidMonth ? monthLabel(row.lastPaidMonth) : "nunca"}
                              </Td>
                              <Td className="text-right tabular-nums">{row.streak}</Td>
                              <Td className="text-right tabular-nums">{row.missed12}</Td>
                              <Td
                                className={cn(
                                  "text-right tabular-nums",
                                  row.debt > 0 ? "font-medium text-red-700" : "text-zinc-400",
                                )}
                              >
                                {row.stale ? "·" : fmtEur(row.debt)}
                              </Td>
                              <Td>
                                <div className="flex flex-wrap items-center gap-1">
                                  <SeverityBadge severity={row.severity} />
                                  {row.cadence !== null && (
                                    <Badge tone="amber">paga a cada ~{Math.round(row.cadence)} meses</Badge>
                                  )}
                                  {row.stale && <Badge tone="amber">confirmar se cessou</Badge>}
                                </div>
                              </Td>
                            </tr>
                            {isOpen && (
                              <tr>
                                <Td colSpan={TABLE_COLS} className="bg-zinc-50/70">
                                  <MonthsGrid months={row.months24} />
                                </Td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>

                {/* Mobile: um cartão por contrato, com o mesmo toggle de detalhe mensal. */}
                <div className="space-y-2 md:hidden">
                  {filtered.map((row) => {
                    const isOpen = expandedId === row.contractId;
                    return (
                      <div key={row.contractId} className="rounded-lg border border-zinc-200 bg-white shadow-xs">
                        <div
                          onClick={() => setExpandedId(isOpen ? null : row.contractId)}
                          className="flex cursor-pointer items-start justify-between gap-2 p-3"
                        >
                          <div className="min-w-0">
                            <Link
                              href={`/fracoes/${row.propertyId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-teal-700 hover:underline"
                            >
                              {row.propertyName}
                            </Link>
                            <p className="truncate text-xs text-zinc-500">{row.tenantName}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <SeverityBadge severity={row.severity} />
                            <button
                              type="button"
                              aria-label={isOpen ? "Recolher detalhe mensal" : "Expandir detalhe mensal"}
                              aria-expanded={isOpen}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedId(isOpen ? null : row.contractId);
                              }}
                              className="-m-1.5 flex h-10 w-10 items-center justify-center rounded text-zinc-400 transition-colors duration-150 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                            >
                              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-zinc-100 px-3 py-2.5 text-sm">
                          <div>
                            <p className="text-[11px] text-zinc-400">Renda</p>
                            <p className="tabular-nums font-medium text-zinc-800">
                              <RentCell rent={row.rent} expectedRent={row.expectedRent} />
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-zinc-400">Último mês pago</p>
                            <p className="font-mono text-xs tabular-nums text-zinc-700">
                              {row.lastPaidMonth ? monthLabel(row.lastPaidMonth) : "nunca"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-zinc-400">Meses em atraso</p>
                            <p className="tabular-nums text-zinc-800">{row.streak}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-zinc-400">Em falta (12m)</p>
                            <p className="tabular-nums text-zinc-800">{row.missed12}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-zinc-400">Dívida estimada</p>
                            <p
                              className={cn(
                                "tabular-nums",
                                row.debt > 0 ? "font-medium text-red-700" : "text-zinc-400",
                              )}
                            >
                              {row.stale ? "·" : fmtEur(row.debt)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-zinc-400">Senhorio(s)</p>
                            <p className="truncate text-zinc-700">{row.landlordNames.join(", ") || "n/d"}</p>
                          </div>
                          {(row.cadence !== null || row.stale) && (
                            <div className="col-span-2 flex flex-wrap gap-1">
                              {row.cadence !== null && (
                                <Badge tone="amber">paga a cada ~{Math.round(row.cadence)} meses</Badge>
                              )}
                              {row.stale && <Badge tone="amber">confirmar se cessou</Badge>}
                            </div>
                          )}
                        </div>
                        {isOpen && (
                          <div className="border-t border-zinc-100 bg-zinc-50/70 px-3 py-2">
                            <MonthsGrid months={row.months24} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          Baseado nos recibos e pagamentos registados. Rendas pagas em dinheiro sem recibo aparecem
          como atraso. Carência de 8 dias sobre o dia 1; dívida estimada limitada a 24 meses;
          contratos com cadência própria (ex.: pagamento trimestral) são assinalados e não contam
          como atraso dentro do seu ritmo. Um mês conta como pago quando o valor recebido chega
          ao que o contrato costuma receber (mediana dos últimos 24 meses), e não à renda
          contratada: onde os dois divergem mostra-se &quot;recebe X&quot; — é retenção na fonte
          ou uma atualização de renda ainda sem recibos novos, não dívida. Sem recibos há mais de
          12 meses, o contrato é assinalado para confirmação em vez de acumular dívida.
        </p>
      </Card>
    </div>
  );
}
