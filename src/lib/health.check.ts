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
    orphanReceipts: 0, today: "2026-07-23", ...over,
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

// C) Retenção na fonte (600 contratado, 450 recebido = -25%) aparece como AVISO, não como
// erro — é a causa legítima mais comum e não pode ser apresentada como dado corrompido.
{
  const issues = run({ arrears: [arrearsRow({ rent: 600, expectedRent: 450 })] });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, "renda_desalinhada");
  assert.equal(issues[0].severity, "aviso");
  assert.ok(
    !issues[0].detail.includes("os recibos mostram"),
    "o numero comparado vem dos PAGAMENTOS (cash liquido), nao dos recibos — dizer 'recibos' era falso",
  );
}

// C3) REGRESSÃO (2026-07-30, caso Tevisil): uma ATUALIZAÇÃO DE RENDA real não pode disparar
// este aviso. O `expectedRent` dos Atrasos é `min(renda, mediana dos pagamentos)` de uma
// janela: quando a renda sobe, a janela ainda tem meses ao valor antigo e a mediana fica lá
// meses a fio. Com o limiar antigo de 1 EUR absoluto, os 7 EUR de subida (357 vs 350, 2%)
// davam um aviso a afirmar que "os recibos mostram 350" — quando os recibos mostravam 357.
// O limiar passou a ser relativo, o mesmo DESALINHAMENTO_MIN de lib/rent.ts.
{
  const semAviso = run({ arrears: [arrearsRow({ rent: 357, expectedRent: 350 })] });
  assert.equal(
    semAviso.filter((i) => i.kind === "renda_desalinhada").length,
    0,
    "2% e a atualizacao anual a chegar aos pagamentos, nao um desalinhamento",
  );
  // E a retenção continua a passar: 25% está muito acima dos 5%.
  const comAviso = run({ arrears: [arrearsRow({ rent: 357, expectedRent: 268 })] });
  assert.equal(comAviso.filter((i) => i.kind === "renda_desalinhada").length, 1);
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

// I) Terreno/vendido (P0-2c): nenhum check dispara para estas frações, mesmo com dados
// que noutra fração dariam erro (contrato-zombie, renda inválida, ficha incompleta).
{
  const terreno = property("p1", {
    status: "terreno", area_m2: null, typology: null, dicofre: null, vpt: null,
  });
  const issuesTerreno = run({
    properties: [terreno],
    contracts: [contract("c1", { rent: 0 })],
    arrears: [arrearsRow({ stale: true, streak: 40 })],
    owners: [{ property_id: "p1", landlord_id: "l1", quota: 33 }],
  });
  assert.equal(issuesTerreno.length, 0, "terreno não gera nenhuma anomalia");

  const vendido = property("p1", { status: "vendido" });
  const issuesVendido = run({
    properties: [vendido],
    contracts: [contract("c1", { rent: 0, end_date: "2020-01-01" })],
    arrears: [arrearsRow({ stale: true, streak: 40 })],
    owners: [{ property_id: "p1", landlord_id: "l1", quota: 50 }],
  });
  assert.equal(issuesVendido.length, 0, "vendido não gera nenhuma anomalia");

  // Uma fração normal ao lado continua a ser avaliada normalmente.
  const mixed = run({
    properties: [terreno, property("p2", { status: "arrendado", area_m2: null, typology: null, dicofre: null, vpt: null })],
    contracts: [],
    arrears: [],
  });
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0].kind, "ficha_incompleta");
  assert.equal(mixed[0].title, "Fração p2");
}

// H) Contrato ativo com data de fim já passada (P2-8) — aviso, não erro (pode ser esquecimento
//    de renovação, não necessariamente um contrato morto).
{
  const issues = run({
    properties: [property("p1", { area_m2: 80, typology: "T2", dicofre: "110501", vpt: 50000 })],
    contracts: [contract("c1", { end_date: "2026-01-01" })],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, "contrato_expirado");
  assert.equal(issues[0].severity, "aviso");
}
{
  // Fim no futuro, ou já cessado, não gera aviso.
  const futuro = run({
    properties: [property("p1", { area_m2: 80, typology: "T2", dicofre: "110501", vpt: 50000 })],
    contracts: [contract("c1", { end_date: "2030-01-01" })],
  });
  assert.equal(futuro.length, 0);
  const cessado = run({
    properties: [property("p1", { area_m2: 80, typology: "T2", dicofre: "110501", vpt: 50000 })],
    contracts: [contract("c1", { end_date: "2026-01-01", status: "cessado" })],
  });
  assert.equal(cessado.length, 0);
}

// J — renda BAIXA demais face aos recibos. Este erro era INVISÍVEL: o `renda_desalinhada`
// só vê o recebido a ficar ABAIXO do contrato, porque a renda de referência dos Atrasos está
// limitada a min(rent, mediana). Caso real: 1825765 a 175 EUR quando 18 meses repetem 331.
{
  const issues = computeHealth({
    properties: [property("p1", { name: "Repeses First" })],
    contracts: [contract("c1", { property_id: "p1", rent: 175 })],
    owners: [],
    arrears: [],
    orphanReceipts: 0,
    rendaObservada: { c1: { valor: 331, vezes: 18 } },
    today: "2026-07-20",
  });
  const erro = issues.find((i) => i.kind === "renda_errada");
  assert.ok(erro, "renda 175 contra 331 nos recibos tem de dar erro");
  assert.equal(erro.severity, "erro");
  assert.ok(erro.detail.includes("156"), "diz quanto falta por mes");

  // E a atualizacao anual pelo coeficiente (~2%) NAO pode disparar: eram 19 dos 21
  // desvios da carteira real, e alertar sobre eles tornaria o aviso inutil.
  const semAlerta = computeHealth({
    properties: [property("p1", { name: "1ESQ" })],
    contracts: [contract("c1", { property_id: "p1", rent: 317 })],
    owners: [],
    arrears: [],
    orphanReceipts: 0,
    rendaObservada: { c1: { valor: 311, vezes: 12 } },
    today: "2026-07-20",
  });
  assert.equal(semAlerta.filter((i) => i.kind === "renda_errada").length, 0, "2% e o coeficiente");
}

console.log("health: casos OK (A, B, C, C2, C3, D, E, F, G, H, I, J)");
