// Self-check de irs.ts. Correr com `npm run check:irs`.
import assert from "node:assert/strict";
import {
  AUTONOMOUS_RATE,
  IRS_BRACKETS_BY_YEAR,
  bracketsForYear,
  aimiExposure,
  anexoFRows,
  classifyUso,
  computeLandlordFiscalYear,
  parseMatriz,
  progressiveTax,
  reducedRateEligibility,
  yearsBetween,
} from "./irs";
import type { Contract, Property, PropertyOwner } from "./types";

// ---------- progressiveTax: casos calculados à mão ----------
const B2025 = IRS_BRACKETS_BY_YEAR[2025]!;
const B2026 = IRS_BRACKETS_BY_YEAR[2026]!;
{
  // Dentro do 1º escalão só: 8059 x 12,5% = 1007,375 -> 1007,38
  const t = progressiveTax(8_059, B2025);
  assert.equal(t, 1007.38, "1º escalão à mão");
}
{
  // 1º escalão completo (8059 x 12,5% = 1007,375) + fatia do 2º (1941 x 16% = 310,56)
  const t = progressiveTax(10_000, B2025);
  assert.equal(t, 1317.94, "englobamento à mão: 1007,375 + 310,56 = 1317,935 ~ 1317,94");
}
{
  // 2026 com o MESMO rendimento paga menos: limites subiram 3,51% e as taxas do 2º ao 5º
  // escalão desceram 0,3 p.p. 8342 x 12,5% = 1042,75 + (10000-8342=1658) x 15,7% = 260,306
  const t = progressiveTax(10_000, B2026);
  assert.equal(t, 1303.06, "englobamento 2026 à mão: 1042,75 + 260,306 = 1303,056 ~ 1303,06");
  assert.ok(t < progressiveTax(10_000, B2025), "2026 não pode ser mais caro que 2025 a igual rendimento");
}
assert.equal(progressiveTax(0, B2025), 0);
assert.equal(progressiveTax(-100, B2025), 0, "rendimento negativo -> imposto 0");

// ---------- bracketsForYear: cada ano fiscal com a SUA tabela ----------
assert.equal(bracketsForYear(2025).bracketsYear, 2025);
assert.equal(bracketsForYear(2026).bracketsYear, 2026);
assert.equal(bracketsForYear(2027).bracketsYear, 2026, "ano futuro sem OE: usa a tabela mais recente");
assert.equal(bracketsForYear(2020).bracketsYear, 2025, "ano anterior à tabela mais antiga: não rebenta");

// ---------- taxa autónoma 28%: caso calculado à mão ----------
{
  const autonomousTax = Math.round(5_000 * AUTONOMOUS_RATE * 100) / 100;
  assert.equal(autonomousTax, 1400, "5000 x 28% = 1400 à mão");
}

// ---------- computeLandlordFiscalYear ----------
{
  const owners: PropertyOwner[] = [{ property_id: "p1", landlord_id: "L1", quota: 50 }];
  const receipts = [
    // Emitido em 2025-01-05: conta TODO para o ano fiscal 2025 (ano de recebimento),
    // independentemente do mês da renda a que respeitasse originalmente.
    { property_id: "p1", amount: 3000, withholding: 500, issue_date: "2025-01-05" },
    // Emitido em 2024 -- armadilha: NÃO deve entrar no ano fiscal 2025.
    { property_id: "p1", amount: 200, withholding: 0, issue_date: "2024-12-20" },
  ];
  const expenses = [
    { property_id: "p1", category: "imi" as const, amount: 1200, expense_date: "2025-03-01" },
    { property_id: "p1", category: "condominio" as const, amount: 300, expense_date: "2025-04-01" },
    // "obras" é ambígua (conservação vs valorização) -> não deduz, fica "a confirmar".
    { property_id: "p1", category: "obras" as const, amount: 5_000, expense_date: "2025-05-01" },
    // seguro/financiamento: excluídos por completo (nem deduzidos nem "a confirmar").
    { property_id: "p1", category: "seguro" as const, amount: 400, expense_date: "2025-06-01" },
    { property_id: "p1", category: "financiamento" as const, amount: 800, expense_date: "2025-07-01" },
    // Ano errado -- não deve entrar no ano fiscal 2025.
    { property_id: "p1", category: "imi" as const, amount: 1_000, expense_date: "2024-05-01" },
  ];

  const r = computeLandlordFiscalYear("L1", 2025, owners, receipts, expenses);
  assert.equal(r.grossRent, 1750, "(3000+500) x 50% -- o recibo de 2024 fica de fora");
  assert.equal(r.withholding, 250, "500 x 50%");
  assert.equal(r.deductibleExpenses, 750, "(1200 imi + 300 condominio) x 50%");
  assert.equal(r.toConfirmExpenses, 2_500, "5000 obras x 50% -- não deduzido, só listado");
  assert.equal(r.netIncome, 1_000, "1750 - 750");
  assert.equal(r.autonomousTax, 280, "1000 x 28%");
  assert.equal(r.englobedTax, progressiveTax(1_000, B2025), "consistente com progressiveTax");
  assert.equal(r.englobedTax, 125, "1000 x 12,5% (1º escalão só) à mão");
  assert.equal(r.bestRegime, "englobamento", "125 < 280");
  assert.equal(r.bestTax, 125);
}
{
  // Rendimento líquido elevado -> a taxa autónoma de 28% ganha ao englobamento.
  const owners: PropertyOwner[] = [{ property_id: "p1", landlord_id: "L1", quota: 100 }];
  const receipts = [{ property_id: "p1", amount: 100_000, withholding: 0, issue_date: "2025-06-01" }];
  const r = computeLandlordFiscalYear("L1", 2025, owners, receipts, []);
  assert.equal(r.netIncome, 100_000);
  assert.equal(r.autonomousTax, 28_000);
  assert.ok(r.englobedTax > r.autonomousTax, "escalões altos superam os 28%");
  assert.equal(r.bestRegime, "autonoma");
  assert.equal(r.bestTax, 28_000);
}
{
  // Despesas dedutíveis > rendas -> líquido nunca fica negativo.
  const owners: PropertyOwner[] = [{ property_id: "p1", landlord_id: "L1", quota: 100 }];
  const receipts = [{ property_id: "p1", amount: 500, withholding: 0, issue_date: "2025-01-01" }];
  const expenses = [{ property_id: "p1", category: "imi" as const, amount: 2_000, expense_date: "2025-01-01" }];
  const r = computeLandlordFiscalYear("L1", 2025, owners, receipts, expenses);
  assert.equal(r.netIncome, 0);
  assert.equal(r.autonomousTax, 0);
}

// ---------- classifyUso ----------
assert.equal(classifyUso("T2"), "habitacao");
assert.equal(classifyUso("t0"), "habitacao");
assert.equal(classifyUso("Habitação"), "habitacao");
assert.equal(classifyUso("Loja"), "comercial");
assert.equal(classifyUso("Garagem"), "comercial");
assert.equal(classifyUso("Armazém"), "comercial");
assert.equal(classifyUso(""), "a_confirmar");
assert.equal(classifyUso(null), "a_confirmar");
assert.equal(classifyUso("Misto"), "a_confirmar");

// ---------- yearsBetween ----------
assert.equal(yearsBetween("2021-01-01", "2026-01-01"), 5, "5 anos exatos");
assert.equal(yearsBetween("2021-01-02", "2026-01-01"), 4, "falta 1 dia para os 5 anos");
assert.equal(yearsBetween("2016-01-01", "2026-01-01"), 10);
assert.equal(yearsBetween("2006-01-01", "2026-01-01"), 20);

// ---------- reducedRateEligibility (P2-7) ----------
{
  // Exatamente 5 anos -> 15%.
  const c: Pick<Contract, "id" | "property_id" | "start_date" | "rent"> = {
    id: "c1", property_id: "p1", start_date: "2021-01-01", rent: 500,
  };
  const r = reducedRateEligibility(c, "T2", 100, "2026-01-01");
  assert.equal(r.durationYears, 5);
  assert.equal(r.eligibleRate, 0.15);
}
{
  // Exatamente 10 anos, quota 50% -> 10%; poupança calculada à mão.
  const c: Pick<Contract, "id" | "property_id" | "start_date" | "rent"> = {
    id: "c2", property_id: "p1", start_date: "2016-01-01", rent: 500,
  };
  const r = reducedRateEligibility(c, "T2", 50, "2026-01-01");
  assert.equal(r.eligibleRate, 0.10);
  // (28% - 10%) x 500 x 12 x 50% = 18% x 3000 = 540
  assert.equal(r.annualSavings, 540, "poupança à mão: 18% de 3000");
}
{
  // Exatamente 20 anos -> 5%.
  const c: Pick<Contract, "id" | "property_id" | "start_date" | "rent"> = {
    id: "c3", property_id: "p1", start_date: "2006-01-01", rent: 500,
  };
  const r = reducedRateEligibility(c, "T2", 100, "2026-01-01");
  assert.equal(r.eligibleRate, 0.05);
}
{
  // Menos de 5 anos -> não elegível.
  const c: Pick<Contract, "id" | "property_id" | "start_date" | "rent"> = {
    id: "c4", property_id: "p1", start_date: "2022-01-01", rent: 500,
  };
  const r = reducedRateEligibility(c, "T2", 100, "2026-01-01");
  assert.equal(r.eligibleRate, null);
  assert.equal(r.annualSavings, null);
}
{
  // Comércio nunca beneficia, mesmo com contrato antigo.
  const c: Pick<Contract, "id" | "property_id" | "start_date" | "rent"> = {
    id: "c5", property_id: "p1", start_date: "2000-01-01", rent: 25,
  };
  const r = reducedRateEligibility(c, "Garagem", 100, "2026-01-01");
  assert.equal(r.uso, "comercial");
  assert.equal(r.eligibleRate, null);
}
{
  // Sem tipologia preenchida -> "a confirmar", nunca se assume habitação.
  const c: Pick<Contract, "id" | "property_id" | "start_date" | "rent"> = {
    id: "c6", property_id: "p1", start_date: "2000-01-01", rent: 300,
  };
  const r = reducedRateEligibility(c, null, 100, "2026-01-01");
  assert.equal(r.uso, "a_confirmar");
  assert.equal(r.eligibleRate, null);
}
{
  // Habitação sem data de início -> sem duração, sem elegibilidade (não se inventa).
  const c: Pick<Contract, "id" | "property_id" | "start_date" | "rent"> = {
    id: "c7", property_id: "p1", start_date: null, rent: 300,
  };
  const r = reducedRateEligibility(c, "T1", 100, "2026-01-01");
  assert.equal(r.uso, "habitacao");
  assert.equal(r.durationYears, null);
  assert.equal(r.eligibleRate, null);
}

// ---------- aimiExposure (P3-5) ----------
{
  const propertiesById = new Map<string, Pick<Property, "id" | "vpt" | "status">>([
    ["p1", { id: "p1", vpt: 500_000, status: "arrendado" }],
    ["p2", { id: "p2", vpt: 300_000, status: "terreno" }], // excluído (presume-se rústico)
    ["p3", { id: "p3", vpt: 200_000, status: "vendido" }], // excluído (já não é da família)
    ["p5", { id: "p5", vpt: 200_000, status: "arrendado" }],
  ]);
  const owners: PropertyOwner[] = [
    { property_id: "p1", landlord_id: "L1", quota: 100 },
    { property_id: "p2", landlord_id: "L1", quota: 100 },
    { property_id: "p3", landlord_id: "L1", quota: 100 },
    { property_id: "p5", landlord_id: "L1", quota: 100 },
  ];
  const r = aimiExposure("L1", owners, propertiesById);
  assert.equal(r.totalVpt, 700_000, "500k + 200k -- terreno e vendido ficam fora");
  assert.equal(r.overSingle, true);
  assert.equal(r.overCouple, false);
}
{
  // Quota aplicada corretamente e limite de casal ultrapassado.
  const propertiesById = new Map<string, Pick<Property, "id" | "vpt" | "status">>([
    ["p1", { id: "p1", vpt: 700_000, status: "arrendado" }],
    ["p6", { id: "p6", vpt: 1_000_000, status: "arrendado" }],
  ]);
  const owners: PropertyOwner[] = [
    { property_id: "p1", landlord_id: "L1", quota: 100 },
    { property_id: "p6", landlord_id: "L1", quota: 60 },
  ];
  const r = aimiExposure("L1", owners, propertiesById);
  assert.equal(r.totalVpt, 1_300_000, "700k + 60% de 1.000.000");
  assert.equal(r.overCouple, true);
}

// ---------- parseMatriz ----------
{
  const m = parseMatriz("182341-U-2381-K");
  assert.deepEqual(m, { freguesia: "182341", tipo: "U", artigo: "2381", fracaoSeccao: "K" });
}
{
  const m = parseMatriz("182301-R-401");
  assert.deepEqual(m, { freguesia: "182301", tipo: "R", artigo: "401", fracaoSeccao: null });
}
{
  const m = parseMatriz(null);
  assert.deepEqual(m, { freguesia: null, tipo: null, artigo: null, fracaoSeccao: null });
}

// ---------- anexoFRows: integração (reaproveita os números dos casos acima) ----------
{
  const owners: PropertyOwner[] = [{ property_id: "p1", landlord_id: "L1", quota: 50 }];
  const contracts = [
    { id: "c1", property_id: "p1", pf_contract_no: "123", start_date: "2016-01-01", rent: 500 },
    // p2 não pertence a L1 (sem property_owners) -- não deve aparecer nas linhas.
    { id: "c2", property_id: "p2", pf_contract_no: "456", start_date: "2020-01-01", rent: 300 },
  ];
  const propertiesById = new Map<string, Pick<Property, "id" | "matriz_article" | "typology">>([
    ["p1", { id: "p1", matriz_article: "182341-U-2381-K", typology: "T2" }],
    ["p2", { id: "p2", matriz_article: "182341-U-9999-Z", typology: "T1" }],
  ]);
  const receipts = [{ property_id: "p1", amount: 3_000, withholding: 500, issue_date: "2025-01-05" }];
  const expenses = [
    { property_id: "p1", category: "imi" as const, amount: 1_200, expense_date: "2025-03-01" },
    { property_id: "p1", category: "condominio" as const, amount: 300, expense_date: "2025-04-01" },
  ];

  const rows = anexoFRows("L1", 2025, owners, contracts, propertiesById, receipts, expenses, "2026-01-01");
  assert.equal(rows.length, 1, "só o contrato da fração que L1 possui");
  const row = rows[0];
  assert.equal(row.contractId, "c1");
  assert.deepEqual(row.matriz, { freguesia: "182341", tipo: "U", artigo: "2381", fracaoSeccao: "K" });
  assert.equal(row.grossRent, 1_750, "(3000+500) x 50%");
  assert.equal(row.withholding, 250, "500 x 50%");
  assert.equal(row.imi, 600, "1200 x 50%");
  assert.equal(row.condominio, 150, "300 x 50%");
  assert.equal(row.reduced.eligibleRate, 0.10, "10 anos de contrato");
  assert.equal(row.reduced.annualSavings, 540);
}

console.log("irs.check.ts: OK");
