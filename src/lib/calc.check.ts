// Self-check de calc.ts. Correr com `npm run check:calc`.
import assert from "node:assert/strict";
import { benchmarkForMetric, currentProperties, isCurrentProperty, marketView, missingFichaFields, rentUpdateEligibility, upcomingContractEnds, vacancyGaps } from "./calc";
import { dicofreFromGeocod } from "./ine";
import type { Contract, MarketBenchmark, Property, RentUpdate, UpdateCoefficient } from "./types";

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

// missingFichaFields: a regra tem DOIS consumidores (Saúde dos dados e a tira de
// Cobertura) e tem de dar o mesmo nos dois. A ordem dos nomes é a que a UI mostra.
{
  assert.deepEqual(
    missingFichaFields({ area_m2: null, typology: null, dicofre: null, vpt: null }),
    ["área", "tipologia", "freguesia", "VPT"],
  );
  assert.deepEqual(
    missingFichaFields({ area_m2: 64, typology: "T2", dicofre: "182341", vpt: 50_000 }),
    [],
    "ficha completa não devolve nada",
  );
  assert.deepEqual(
    missingFichaFields({ area_m2: 64, typology: "", dicofre: "182341", vpt: 50_000 }),
    ["tipologia"],
    "string vazia conta como em falta",
  );
  // 0 é falsy e é o caso real: uma fração com VPT 0 ou área 0 está por preencher,
  // não preenchida a zero. Documentado aqui para não ser "corrigido" para != null.
  assert.deepEqual(
    missingFichaFields({ area_m2: 0, typology: "T1", dicofre: "182341", vpt: 0 }),
    ["área", "VPT"],
  );
}

// As medianas do INE são de alojamentos familiares. Depois das cadernetas prediais
// (2026-07-29) a carteira passou a ter área em lojas, garagens e arrecadações — sem esta
// guarda, uma garagem de 276 m² a 25 €/mês entrava na mediana de yield da carteira e saía
// como "candidato a venda". Uso não habitacional (e "a confirmar") não tem benchmark.
{
  const benchmarks: MarketBenchmark[] = [
    {
      id: "b1", dicofre: "182341", parish_name: null, municipality: null, period: "2025S2",
      rent_median_m2: 6, sale_median_m2: 1500, level: "freguesia", source: "ine",
    },
  ];
  const casa = property({ dicofre: "182341", typology: "T2", area_m2: 100 });
  const loja = property({ dicofre: "182341", typology: "Comércio", area_m2: 100 });
  const garagem = property({ dicofre: "182341", typology: "garagem", area_m2: 276.5 });
  const porConfirmar = property({ dicofre: "182341", typology: null, area_m2: 100 });

  assert.ok(benchmarkForMetric(casa, benchmarks, "rent"), "habitação compara-se ao INE");
  assert.equal(benchmarkForMetric(loja, benchmarks, "rent"), undefined);
  assert.equal(benchmarkForMetric(garagem, benchmarks, "sale"), undefined);
  assert.equal(benchmarkForMetric(porConfirmar, benchmarks, "sale"), undefined);

  const vistaGaragem = marketView(garagem, contract({ rent: 25 }), benchmarks);
  assert.equal(vistaGaragem.grossYield, null, "garagem não tem yield contra o INE");
  assert.equal(vistaGaragem.estimatedValue, null);
  assert.equal(vistaGaragem.deviation, null);
  assert.ok(vistaGaragem.rentPerM2 !== null, "o €/m² próprio continua a ser um facto");

  const vistaCasa = marketView(casa, contract({ rent: 500 }), benchmarks);
  assert.equal(vistaCasa.estimatedValue, 150_000);
  assert.equal(vistaCasa.grossYield, 0.04);
}

// Bug B5: o território tem de ser o DICOFRE dos dois lados. O `geocod` do INE é
// NUTS III + DICOFRE (`1941823` = `194` + `18` + `23`), e enquanto o benchmark guardou o
// geocod e a fração o DICOFRE da caderneta, o Mercado nunca casou nada — com a base cheia
// de benchmarks. `dicofreFromGeocod` (ine.ts) corta o NUTS; estes casos fixam as duas
// pontas: a freguesia por igualdade, o concelho por prefixo de 4 dígitos.
{
  assert.equal(dicofreFromGeocod("1941823"), "1823", "concelho: NUTS III fora");
  assert.equal(dicofreFromGeocod("194182341"), "182341", "freguesia: NUTS III fora");

  const benchmarks: MarketBenchmark[] = [
    {
      id: "concelho", dicofre: "1823", parish_name: null, municipality: "Viseu",
      period: "2026T1", rent_median_m2: 6.72, sale_median_m2: 1500,
      level: "concelho", source: "ine",
    },
    {
      id: "freguesia", dicofre: "182341", parish_name: "União das Freguesias de Viseu",
      municipality: "Viseu", period: "2026T1", rent_median_m2: 7.5, sale_median_m2: 1800,
      level: "freguesia", source: "ine",
    },
  ];
  const daFreguesia = property({ dicofre: "182341", typology: "T2", area_m2: 100 });
  const doConcelho = property({ dicofre: "181710", typology: "T2", area_m2: 100 });

  assert.equal(benchmarkForMetric(daFreguesia, benchmarks, "rent")?.id, "freguesia",
    "a freguesia exata ganha ao concelho");
  assert.equal(benchmarkForMetric(doConcelho, benchmarks, "rent"), undefined,
    "Sátão (1817) não cai no concelho de Viseu (1823) por acidente");
  assert.equal(
    benchmarkForMetric(property({ dicofre: "182319", typology: "T2" }), benchmarks, "rent")?.id,
    "concelho",
    "outra freguesia do concelho de Viseu cai no concelho por prefixo",
  );
}

console.log("calc.check.ts: OK");
