"use client";

import { useState } from "react";
import { Trash2, TrendingUp } from "lucide-react";
import { useAction } from "@/components/forms";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Table, Td, Th } from "@/components/ui";
import { deleteBenchmark, refreshIne, saveBenchmark } from "@/lib/actions/market";
import { fmtDate, fmtNum } from "@/lib/format";
import { parseAmount } from "@/lib/parse";
import type { MarketBenchmark } from "@/lib/types";

function DeleteBenchmarkButton({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="inline-flex flex-col">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label="Apagar benchmark"
        onClick={() => {
          if (confirm("Apagar este benchmark?")) run(deleteBenchmark(id));
        }}
      >
        <Trash2 size={14} />
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function IneCard({
  ineCount,
  inePeriods,
  ineLastFetch,
  manualBenchmarks,
}: {
  ineCount: number;
  inePeriods: string[];
  ineLastFetch: string | null;
  manualBenchmarks: MarketBenchmark[];
}) {
  const refreshAction = useAction();
  const [refreshInfo, setRefreshInfo] = useState<string | null>(null);

  function handleRefresh() {
    setRefreshInfo(null);
    refreshAction.run(
      refreshIne().then((res) => {
        if (res.ok) setRefreshInfo(res.info ?? null);
        return res;
      }),
    );
  }

  const addAction = useAction();
  const [form, setForm] = useState({
    dicofre: "",
    parish_name: "",
    municipality: "",
    period: "",
    rent_median_m2: "",
    sale_median_m2: "",
    level: "freguesia" as "freguesia" | "concelho",
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    addAction.run(
      saveBenchmark({
        dicofre: form.dicofre,
        parish_name: form.parish_name || null,
        municipality: form.municipality || null,
        period: form.period,
        rent_median_m2: form.rent_median_m2 ? parseAmount(form.rent_median_m2) : null,
        sale_median_m2: form.sale_median_m2 ? parseAmount(form.sale_median_m2) : null,
        level: form.level,
        source: "manual",
      }),
      () =>
        setForm({
          dicofre: "",
          parish_name: "",
          municipality: "",
          period: "",
          rent_median_m2: "",
          sale_median_m2: "",
          level: "freguesia",
        }),
    );
  }

  return (
    <Card
      title="Benchmarks de mercado (INE)"
      actions={
        <Button size="sm" onClick={handleRefresh} disabled={refreshAction.pending}>
          {refreshAction.pending ? "A atualizar…" : "Atualizar do INE agora"}
        </Button>
      }
    >
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-zinc-500">Territórios carregados</dt>
          <dd className="font-medium tabular-nums">{fmtNum(ineCount, 0)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Períodos disponíveis</dt>
          <dd className="font-mono font-medium">{inePeriods.length > 0 ? inePeriods.join(", ") : "n/d"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Última atualização</dt>
          <dd className="font-medium">{fmtDate(ineLastFetch)}</dd>
        </div>
      </dl>

      {refreshInfo && <p className="mt-2 text-sm text-emerald-700">{refreshInfo}</p>}
      {refreshAction.error && <p className="mt-2 text-xs text-red-600">{refreshAction.error}</p>}

      <p className="mt-3 text-xs text-zinc-500">
        Vai buscar as medianas €/m² de rendas (novos contratos, últimos 12 meses) e de vendas, por
        concelho e freguesia: indicadores oficiais 0014771 e 0012246. Atualiza trimestralmente.
      </p>

      <div className="mt-5 border-t border-zinc-100 pt-4">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Benchmark manual
        </p>
        <p className="mb-3 text-xs text-zinc-500">
          Para freguesias sem dados do INE, ou para usar comparáveis próprios.
        </p>
        <form onSubmit={submitManual} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Código (dicofre) *">
            <Input value={form.dicofre} onChange={(e) => set("dicofre", e.target.value)} required />
          </Field>
          <Field label="Freguesia">
            <Input value={form.parish_name} onChange={(e) => set("parish_name", e.target.value)} />
          </Field>
          <Field label="Concelho">
            <Input value={form.municipality} onChange={(e) => set("municipality", e.target.value)} />
          </Field>
          <Field label="Período *">
            <Input
              value={form.period}
              onChange={(e) => set("period", e.target.value)}
              placeholder="2026T1"
              required
            />
          </Field>
          <Field label="Renda €/m²">
            <Input
              value={form.rent_median_m2}
              onChange={(e) => set("rent_median_m2", e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field label="Venda €/m²">
            <Input
              value={form.sale_median_m2}
              onChange={(e) => set("sale_median_m2", e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field label="Nível">
            <Select value={form.level} onChange={(e) => set("level", e.target.value)}>
              <option value="freguesia">Freguesia</option>
              <option value="concelho">Concelho</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" size="sm" disabled={addAction.pending} className="w-full">
              {addAction.pending ? "A gravar…" : "Adicionar"}
            </Button>
          </div>
        </form>
        {addAction.error && <p className="mt-2 text-xs text-red-600">{addAction.error}</p>}

        {manualBenchmarks.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon={TrendingUp}>Sem benchmarks manuais.</EmptyState>
          </div>
        ) : (
          <Table className="mt-3">
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Território</Th>
                <Th>Período</Th>
                <Th>Nível</Th>
                <Th className="text-right">Renda €/m²</Th>
                <Th className="text-right">Venda €/m²</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {manualBenchmarks.map((b) => (
                <tr key={b.id} className="hover:bg-zinc-50">
                  <Td className="font-mono">{b.dicofre}</Td>
                  <Td>{b.parish_name ?? b.municipality ?? "n/d"}</Td>
                  <Td className="font-mono">{b.period}</Td>
                  <Td>
                    <Badge tone="zinc">{b.level === "freguesia" ? "Freguesia" : "Concelho"}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">
                    {b.rent_median_m2 !== null ? fmtNum(b.rent_median_m2, 2) : "n/d"}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {b.sale_median_m2 !== null ? fmtNum(b.sale_median_m2, 2) : "n/d"}
                  </Td>
                  <Td>
                    <DeleteBenchmarkButton id={b.id} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </Card>
  );
}
