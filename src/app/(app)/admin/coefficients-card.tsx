"use client";

import { useState } from "react";
import { useAction } from "@/components/forms";
import { Button, Card, Field, Input, Table, Td, Th } from "@/components/ui";
import { saveUpdateCoefficient } from "@/lib/actions/crud";
import type { UpdateCoefficient } from "@/lib/types";

export function CoefficientsCard({ coefficients }: { coefficients: UpdateCoefficient[] }) {
  const { pending, error, run } = useAction();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [coefficient, setCoefficient] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const y = Number(year);
    const c = Number(coefficient.replace(",", "."));
    if (!Number.isInteger(y) || !Number.isFinite(c) || c <= 0) return;
    run(saveUpdateCoefficient({ year: y, coefficient: c }), () => setCoefficient(""));
  }

  const rows = coefficients.slice().sort((a, b) => b.year - a.year);

  return (
    <Card
      title="Coeficientes de atualização de rendas"
      subtitle="Publicados anualmente (ex.: 1,0216 para 2026). Usados para sugerir a renda atualizável em cada contrato."
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <Field label="Ano">
          <Input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" className="w-24" />
        </Field>
        <Field label="Coeficiente">
          <Input
            value={coefficient}
            onChange={(e) => setCoefficient(e.target.value)}
            inputMode="decimal"
            placeholder="1,0216"
            className="w-28"
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "A gravar…" : "Guardar"}
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {rows.length > 0 && (
        <Table className="mt-4">
          <thead>
            <tr>
              <Th>Ano</Th>
              <Th>Coeficiente</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.year} className="hover:bg-zinc-50">
                <Td className="tabular-nums">{c.year}</Td>
                <Td className="tabular-nums">{c.coefficient}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
