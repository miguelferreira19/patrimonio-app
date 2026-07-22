// Self-check da Saúde dos dados. Correr com `npm run check:health`.
// Mesmo espírito do arrears.check.ts: sem framework, só os casos que, se se partirem num
// refactor, transformam a página num alarme falso (ou pior, num silêncio falso).
import assert from "node:assert/strict";
import { computeHealth, groupByKind, overlaps, type HealthInput } from "./health";
import type { ArrearsRow } from "./arrears";
import type { Contract, Property, PropertyOwner } from "./types";

function property(id: string, over: Partial<Property> = {}): Property {
  return {
    id, name: `Fração ${id}`, address: null, postal_code: null, municipality: null,
    parish: null, dicofre: "110501", typology: "T2", area_m2: 80, vpt: 50000,
    vpt_year: 2020, matriz_article: null, status: "arrendado", notes: null, ...over,
  };
}

function contract(id: string, over: Partial<Contract> = {}): Contract {
  return {
    id, property_id: "p1", tenant_name: `Inquilino ${id}`, tenant_nif: null,
    pf_contract_no: null, start_date: "2020-01-01", end_date: null, rent: 500,
    due_day: 1, status: "ativo", notes: null, ...over,
  };
}

function arrearsRow(over: Partial<ArrearsRow> = {}): ArrearsRow {
  return {
    contractId: "c1", propertyId: "p1", tenantName: "Inquilino", pfContractNo: null,
    rent: 500, startDate: "2020-01-01", lastPaidMonth: "2026-06-01", expectedRent: 500,
    stale: false, streak: 0, semHistorico: false, cadence: null, severity: "ok",
    debt: 0, missed12: 0, months24: [], ...over,
  };
}

function run(over: Partial<HealthInput> = {}) {
  return computeHealth({
    properties: [property("p1")], contracts: [], owners: [], arrears: [],
    orphanReceipts: 0, ...over,
  });
}

// A) Carteira sã não inventa avisos.
{
  assert.equal(run().length, 0, "carteira completa e coerente não gera anomalias");
}

// B) Contrato-zombie: o `stale` vem de computeArrears, não é recalculado aqui.
{
  const issues = run({ arrears: [arrearsRow({ stale: true, streak: 57 })] });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, "contrato_zombie");
  assert.equal(issues[0].severity, "erro");
}

// C) Retenção na fonte (600 contratado, 450 recebido) aparece como AVISO, não como erro —
// é a causa legítima mais comum e não pode ser apresentada como dado corrompido.
{
  const issues = run({ arrears: [arrearsRow({ rent: 600, expectedRent: 450 })] });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, "renda_desalinhada");
  assert.equal(issues[0].severity, "aviso");
}

// C2) Contrato sem histórico de pagamentos não pode gerar desalinhamento (não há com que comparar).
{
  const issues = run({ arrears: [arrearsRow({ rent: 600, expectedRent: 600, semHistorico: true })] });
  assert.equal(issues.length, 0);
}

// D) Sobreposição: contrato antigo fechado com data de fim não colide com o novo;
// sem data de fim (o erro real) colide.
{
  assert.equal(overlaps("2020-01-01", "2023-12-31", "2024-01-01", null), false);
  assert.equal(overlaps("2020-01-01", null, "2024-01-01", null), true);
  const ok = run({
    contracts: [
      contract("a", { start_date: "2020-01-01", end_date: "2023-12-31", status: "cessado" }),
      contract("b", { start_date: "2024-01-01" }),
    ],
  });
  assert.equal(ok.length, 0, "sucessão normal de inquilinos não é anomalia");

  const bad = run({
    contracts: [contract("a"), contract("b", { start_date: "2024-01-01" })],
  });
  assert.equal(bad.length, 1);
  assert.equal(bad[0].kind, "contratos_sobrepostos");
}

// E) Quotas: só as frações COM quotas registadas são avaliadas (as sem quotas ainda não
// foram preenchidas — isso é ficha incompleta, não um erro de compropriedade).
{
  const half: PropertyOwner[] = [{ property_id: "p1", landlord_id: "l1", quota: 50 }];
  const issues = run({ owners: half });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, "quotas");

  const full: PropertyOwner[] = [
    { property_id: "p1", landlord_id: "l1", quota: 50 },
    { property_id: "p1", landlord_id: "l2", quota: 50 },
  ];
  assert.equal(run({ owners: full }).length, 0);
  assert.equal(run({ owners: [] }).length, 0, "sem quotas registadas não é erro de quotas");
}

// F) Ficha incompleta lista os campos em falta e fica em "info" (não estraga contas).
{
  const issues = run({ properties: [property("p1", { area_m2: null, dicofre: null })] });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, "info");
  assert.match(issues[0].detail, /área/);
  assert.match(issues[0].detail, /freguesia/);
}

// G) Agrupamento respeita a ordem de gravidade (erros antes de info).
{
  const issues = run({
    arrears: [arrearsRow({ stale: true, streak: 30 })],
    properties: [property("p1", { vpt: null })],
  });
  const kinds = groupByKind(issues).map(([k]) => k);
  assert.deepEqual(kinds, ["contrato_zombie", "ficha_incompleta"]);
}

console.log("health: casos OK (A, B, C, C2, D, E, F, G)");
