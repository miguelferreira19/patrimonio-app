import assert from "node:assert/strict";
import { aimiExposure, anexoFRows, computeLandlordFiscalYear, reducedRateEligibility } from "../irs";
import type { Contract, Expense } from "../types";
import type { AnoDoSenhorio } from "./ano";
import { despesasEmFalta, poupancaPorContrato, resumoDaPoupanca } from "./poupanca";

const contrato = (id: string, o: Partial<Contract> = {}): Contract => ({
  id, property_id: id, tenant_name: "Inquilino", tenant_nif: null, pf_contract_no: null,
  start_date: "2010-01-01", end_date: null, rent: 800, due_day: 1, status: "ativo",
  notes: null, term_kind: "desconhecido", ...o,
});

function anoSintetico(contratos: Contract[], id = "s1", quota = 100): AnoDoSenhorio {
  const hoje = "2026-11-13";
  const owners = contratos.map((c) => ({ landlord_id: id, property_id: c.property_id, quota }));
  const props = new Map(contratos.map((c) => [c.property_id, {
    id: c.property_id, typology: "T2", matriz_article: null, vpt: 0, status: "arrendado" as const,
  }]));
  const recibos = contratos.map((c) => ({
    contract_id: c.id, property_id: c.property_id, amount: c.rent, withholding: 0,
    issue_date: "2026-01-01",
  }));
  const elegiveisArt72 = contratos.flatMap((c) => {
    const r = reducedRateEligibility(c, "T2", quota, hoje);
    return r.eligibleRate !== null && (r.annualSavings ?? 0) > 0 ? [{
      contract: c, propertyName: c.property_id, rate: r.eligibleRate,
      savings: r.annualSavings!, anos: r.durationYears!,
    }] : [];
  });
  return {
    landlord: { id, name: id }, fy: computeLandlordFiscalYear(id, 2026, owners, recibos, []),
    anexoF: anexoFRows(id, 2026, owners, contratos, props, recibos, [], hoje),
    aimi: aimiExposure(id, owners, props), elegiveisArt72,
    poupancaArt72: elegiveisArt72.reduce((s, e) => s + e.savings, 0),
    prazoPorConfirmar: contratos.length - elegiveisArt72.length,
  };
}

// A. Os valores vêm do Ano/IRS, sem refazer imposto nem usar anos de casa como prazo.
{
  const c = contrato("elegivel", { term_kind: "prazo_certo", expected_end_date: "2030-01-01" });
  const recente = contrato("recente", {
    start_date: "2024-01-01", term_kind: "prazo_certo", expected_end_date: "2029-01-01",
  });
  const ano = anoSintetico([c, recente, contrato("sem-prazo"), contrato("curto", {
    term_kind: "prazo_certo", expected_end_date: "2011-01-01",
  }), contrato("sem-prazo-recente", { start_date: "2025-01-01" })]);
  const linhas = poupancaPorContrato([ano]);
  assert.equal(linhas.length, 5);
  const elegivel = linhas.find((l) => l.contratoId === c.id)!;
  assert.equal(elegivel.falta, null);
  assert.ok(elegivel.eurosPorAno > 0);
  assert.equal(elegivel.eurosPorAno, ano.elegiveisArt72.find((e) => e.contract.id === c.id)!.savings);
  assert.equal(elegivel.taxaAtual, 0.28);
  assert.equal(elegivel.taxaPossivel, 0.05);
  assert.equal(linhas.find((l) => l.contratoId === recente.id)!.taxaAtual, 0.25);
  for (const id of ["sem-prazo", "sem-prazo-recente"]) {
    const l = linhas.find((l) => l.contratoId === id)!;
    assert.equal(l.falta, "registar o prazo do contrato");
    assert.equal(l.eurosPorAno, 0, "o IRS não apurou poupança sem prazo");
  }
  const curto = linhas.find((l) => l.contratoId === "curto")!;
  assert.equal(curto.falta, "prazo inferior a 5 anos");
  assert.equal(curto.taxaPossivel, curto.taxaAtual);
  assert.equal(curto.eurosPorAno, 0);
  assert.equal(resumoDaPoupanca(linhas).realizavel, ano.poupancaArt72);
  assert.equal(resumoDaPoupanca(linhas).porConfirmar, 0);
  assert.deepEqual(resumoDaPoupanca([
    { ...elegivel, eurosPorAno: 0.1 }, { ...elegivel, eurosPorAno: 0.2 },
    { ...elegivel, falta: "registar o prazo do contrato", eurosPorAno: 99 }, curto,
  ]), { realizavel: 0.3, porConfirmar: 99 });
}

// B. Contratos elegíveis sem linha no Anexo F e quotas de dois senhorios não se perdem.
{
  const c = contrato("c1", { term_kind: "prazo_certo", expected_end_date: "2020-01-01" });
  const ana = anoSintetico([c], "Ana", 25);
  const bia = anoSintetico([c], "Bia", 75);
  ana.anexoF = [];
  const linhas = poupancaPorContrato([ana, bia]);
  assert.deepEqual(linhas.map((l) => [l.contratoId, l.propertyId, l.senhorio, l.eurosPorAno]), [
    ["c1", "c1", "Ana", ana.poupancaArt72], ["c1", "c1", "Bia", bia.poupancaArt72],
  ]);
  assert.equal(resumoDaPoupanca(linhas).realizavel, ana.poupancaArt72 + bia.poupancaArt72);
  const comercial = anoSintetico([contrato("loja")]);
  comercial.anexoF[0].reduced.uso = "comercial";
  assert.deepEqual(poupancaPorContrato([comercial]), []);
}

const despesa = (o: Partial<Expense> = {}): Expense => ({
  id: "d1", property_id: "p1", landlord_id: "s1", expense_date: "2025-12-31",
  category: "imi", amount: 90, description: null, origem: "registada", ...o,
});

// C. Só recorrentes registadas no ano anterior e ausentes no ano pedido, por fração/categoria.
{
  const despesas = [despesa(), despesa({ amount: 10 }),
    despesa({ property_id: "p2", category: "condominio", amount: 500 }),
    despesa({ property_id: "p3", category: "seguro", amount: 200 }),
    despesa({ category: "obras", amount: 9000 }), despesa({ property_id: null }),
    despesa({ property_id: "fora" }), despesa({ property_id: "espelhada", origem: "espelhada" }),
    despesa({ property_id: "estimada", origem: "estimada" }),
    despesa({ expense_date: "2024-12-31", property_id: "antiga" }),
    despesa({ expense_date: "2026-01-01", property_id: "so-2026" }),
    despesa({ expense_date: "2026-01-01", origem: "estimada" })];
  const ids = ["p1", "p2", "p3", "espelhada", "estimada", "antiga", "so-2026", "p1"];
  assert.deepEqual(despesasEmFalta(despesas, ids, 2026), [
    { propertyId: "p2", categoria: "condominio", ano: 2026, valorAnterior: 500 },
    { propertyId: "p3", categoria: "seguro", ano: 2026, valorAnterior: 200 },
    { propertyId: "p1", categoria: "imi", ano: 2026, valorAnterior: 100 },
  ]);
  assert.deepEqual(despesasEmFalta([...despesas, despesa({ expense_date: "2026-12-31" })], ["p1"], 2026), []);
  assert.deepEqual(despesasEmFalta([], ids, 2026), []);
  assert.deepEqual(despesasEmFalta(despesas, [], 2026), []);
}

console.log("poupanca.check.ts: OK (A, B, C)");
