// Self-check de calc.ts. Correr com `npm run check:calc`.
import assert from "node:assert/strict";
import { currentProperties, isCurrentProperty, rentUpdateEligibility, upcomingContractEnds, vacancyGaps } from "./calc";
import type { Contract, Property, RentUpdate, UpdateCoefficient } from "./types";

function contract(over: Partial<Contract> = {}): Contract {
  return {
    id: "c1", property_id: "p1", tenant_name: "Inquilino", tenant_nif: null,
    pf_contract_no: null, start_date: "2020-01-01", end_date: null, rent: 500,
    due_day: 1, status: "ativo", notes: null, ...over,
  };
}

function property(over: Partial<Property> = {}): Property {
  return {
    id: "p1", name: "Fração p1", address: null, postal_code: null, municipality: null,
    parish: null, dicofre: null, typology: null, area_m2: null, vpt: null,
    vpt_year: null, matriz_article: null, status: "arrendado", notes: null, ...over,
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

// vacancyGaps: vazio fechado entre dois contratos da mesma fração.
{
  const contracts = [
    contract({ id: "a", property_id: "p1", start_date: "2020-01-01", end_date: "2022-05-31", rent: 600 }),
    contract({ id: "b", property_id: "p1", start_date: "2022-08-01", end_date: null, rent: 650 }),
  ];
  const gaps = vacancyGaps(contracts, "2026-01-01");
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].gapStart, "2022-06-01");
  assert.equal(gaps[0].gapEnd, "2022-08-01");
  assert.equal(gaps[0].days, 61);
  assert.equal(gaps[0].lostRent, Math.round((61 / 30) * 600 * 100) / 100);
}

// vacancyGaps: vazio aberto (fração ainda sem contrato seguinte) conta até hoje.
{
  const contracts = [
    contract({ id: "a", property_id: "p2", start_date: "2024-01-01", end_date: "2025-01-01", rent: 500 }),
  ];
  const gaps = vacancyGaps(contracts, "2025-04-01");
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].gapEnd, null);
  assert.equal(gaps[0].days, 89);
}

// vacancyGaps: renovação same-day (sem folga real) não conta como vazio.
{
  const contracts = [
    contract({ id: "a", property_id: "p3", start_date: "2020-01-01", end_date: "2021-01-01", rent: 500 }),
    contract({ id: "b", property_id: "p3", start_date: "2021-01-02", end_date: null, rent: 500 }),
  ];
  const gaps = vacancyGaps(contracts, "2026-01-01");
  assert.equal(gaps.length, 0);
}

// upcomingContractEnds: só ativos, só dentro do horizonte, ordenado por fim mais próximo.
{
  const contracts = [
    contract({ id: "a", end_date: "2027-01-01" }), // fora do horizonte (90d de 23/07 = ~21/10)
    contract({ id: "b", end_date: "2026-08-01" }),
    contract({ id: "c", end_date: "2026-07-20" }), // já passou
    contract({ id: "d", end_date: "2026-09-01", status: "cessado" }), // não conta, não é ativo
  ];
  const upcoming = upcomingContractEnds(contracts, "2026-07-23", 90);
  assert.deepEqual(upcoming.map((c) => c.id), ["b"]);
}

// isCurrentProperty / currentProperties (P0-2c): terreno e vendido saem das métricas
// correntes; arrendado, vago e outro continuam a contar.
{
  assert.equal(isCurrentProperty(property({ status: "arrendado" })), true);
  assert.equal(isCurrentProperty(property({ status: "vago" })), true);
  assert.equal(isCurrentProperty(property({ status: "outro" })), true);
  assert.equal(isCurrentProperty(property({ status: "terreno" })), false);
  assert.equal(isCurrentProperty(property({ status: "vendido" })), false);

  const list = [
    property({ id: "a", status: "arrendado" }),
    property({ id: "b", status: "terreno" }),
    property({ id: "c", status: "vendido" }),
    property({ id: "d", status: "vago" }),
  ];
  assert.deepEqual(currentProperties(list).map((p) => p.id), ["a", "d"]);
}

console.log("calc.check.ts: OK");
