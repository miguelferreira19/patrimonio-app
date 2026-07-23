// Self-check de calc.ts. Correr com `npm run check:calc`.
import assert from "node:assert/strict";
import { rentUpdateEligibility } from "./calc";
import type { Contract, RentUpdate, UpdateCoefficient } from "./types";

function contract(over: Partial<Contract> = {}): Contract {
  return {
    id: "c1", property_id: "p1", tenant_name: "Inquilino", tenant_nif: null,
    pf_contract_no: null, start_date: "2020-01-01", end_date: null, rent: 500,
    due_day: 1, status: "ativo", notes: null, ...over,
  };
}

// Sem histórico de atualização: base = início do contrato, +12 meses.
{
  const r = rentUpdateEligibility(contract({ start_date: "2024-01-15" }), [], [], "2025-01-14");
  assert.equal(r.eligible, false, "ainda não passaram 12 meses");
}
{
  const r = rentUpdateEligibility(contract({ start_date: "2024-01-15" }), [], [], "2025-01-15");
  assert.equal(r.eligible, true, "12 meses exatos já elegível");
}

// Última atualização de renda substitui o início do contrato como data-base.
{
  const updates: RentUpdate[] = [
    { id: "u1", contract_id: "c1", effective_date: "2025-03-01", old_rent: 480, new_rent: 500, reason: "coeficiente" },
  ];
  const r = rentUpdateEligibility(contract({ start_date: "2020-01-01" }), updates, [], "2026-02-28");
  assert.equal(r.baseDate, "2025-03-01");
  assert.equal(r.eligible, false, "ainda não passaram 12 meses desde a última atualização");
}

// Coeficiente mais recente sugere a nova renda; anos antigos são ignorados.
{
  const coefs: UpdateCoefficient[] = [
    { year: 2025, coefficient: 1.02 },
    { year: 2026, coefficient: 1.0216 },
  ];
  const r = rentUpdateEligibility(contract({ rent: 500, start_date: "2020-01-01" }), [], coefs, "2026-06-01");
  assert.equal(r.suggestedRent, 510.8, "500 x 1.0216 arredondado a 2 casas");
}

// Sem data-base (sem início nem atualização) nunca é elegível.
{
  const r = rentUpdateEligibility(contract({ start_date: null }), [], [], "2030-01-01");
  assert.equal(r.eligible, false);
  assert.equal(r.baseDate, null);
}

console.log("calc.check.ts: OK");
