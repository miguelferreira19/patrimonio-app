// Self-check de PARIDADE do snapshot. Correr com `npm run check:snapshot`.
//
// Porque existe: a Fase 1 do PLANO.md é um refactor que não pode mudar um único número.
// A prova ideal seria abrir a produção e o local lado a lado, mas isso depende de
// credenciais e de a sessão local funcionar. Este check dá a prova que está ao alcance do
// código: corre a lógica ANTIGA do dashboard (copiada expressão por expressão de
// src/app/(app)/page.tsx antes do refactor) e a NOVA (buildSnapshot) sobre os MESMOS
// dados, e exige resultados idênticos.
//
// O conjunto de dados inclui de propósito os casos que já morderam este projeto:
// retenção na fonte, fronteira de dados, terreno, imóvel vendido, fração vaga, ficha
// incompleta e compropriedade.
import assert from "node:assert/strict";
import {
  currentProperties,
  expensesInMonth,
  marketView,
  monthRoll,
  sum,
  upcomingContractEnds,
  vacancyGaps,
} from "../calc";
import { computeArrears } from "../arrears";
import { lastMonthsKeys, monthKeyFromDate } from "../format";
import { buildSnapshot } from "./snapshot";
import type { RawData } from "./load";
import type {
  Contract,
  Expense,
  Landlord,
  MarketBenchmark,
  Payment,
  Property,
  PropertyOwner,
} from "../types";

// ---------- Relógio fixo ----------
// Dia 20 > GRACE_DAYS(8), logo o último mês devido pelo calendário é julho de 2026.
// Os pagamentos vão só até junho, por isso a FRONTEIRA fica em junho e julho é `futuro`.
const TODAY = new Date(2026, 6, 20);
const THIS_MONTH = monthKeyFromDate(TODAY); // "2026-07-01"
const TODAY_ISO = "2026-07-20";

// ---------- Fábricas ----------
function property(over: Partial<Property>): Property {
  return {
    id: "p", name: "Fração", address: null, postal_code: null, municipality: "Viseu",
    parish: "Viseu", dicofre: "182341", typology: "T2", area_m2: 64, vpt: 50_000,
    vpt_year: 2020, matriz_article: null, status: "arrendado", notes: null, ...over,
  };
}
function contract(over: Partial<Contract>): Contract {
  return {
    id: "c", property_id: "p", tenant_name: "Inquilino", tenant_nif: null,
    pf_contract_no: null, start_date: "2020-01-01", end_date: null, rent: 400,
    due_day: 1, status: "ativo", notes: null, ...over,
  };
}
function pagamentos(contractId: string, de: string, ate: string, valor: number): Payment[] {
  const out: Payment[] = [];
  let m = de;
  let i = 0;
  while (m <= ate && i < 200) {
    out.push({
      id: `${contractId}-${m}`, contract_id: contractId, ref_month: m, amount: valor,
      received_date: m, method: "transferencia", source: "recibo", notes: null,
    });
    const y = parseInt(m.slice(0, 4), 10);
    const mm = parseInt(m.slice(5, 7), 10);
    m = mm === 12 ? `${y + 1}-01-01` : `${y}-${String(mm + 1).padStart(2, "0")}-01`;
    i++;
  }
  return out;
}

// ---------- Carteira sintética ----------
const landlords: Landlord[] = [
  { id: "L1", name: "António", nif: "186274220", notes: null },
  { id: "L2", name: "Miguel", nif: "123645891", notes: null },
  // Terceiro senhorio SEM frações: é o caso do Tio Ilídio, e a cobertura tem de o contar
  // como não modelado.
  { id: "L3", name: "Ilidio", nif: null, notes: null },
];

const properties: Property[] = [
  property({ id: "p1", name: "Flores 12" }),
  // Retenção na fonte: contrato de 600, recebe 450. A renda de referência tem de descer
  // para 450 e NÃO gerar dívida (caso A do arrears.check.ts).
  property({ id: "p2", name: "Loja Sé", typology: "loja" }),
  // Terreno: sem contratos, fora de tudo o que é corrente.
  property({ id: "p3", name: "Terreno Repeses", status: "terreno", area_m2: null, typology: null }),
  // Vendido: TEM histórico de contrato e pagamentos, e não pode entrar em nenhuma métrica.
  property({ id: "p4", name: "Casa vendida", status: "vendido" }),
  // Vaga: contrato cessado, sem contrato ativo. Conta no denominador da ocupação.
  property({ id: "p5", name: "Repeses 4" }),
  // Ficha incompleta: sem área nem DICOFRE, logo sem €/m² nem mercado.
  property({ id: "p6", name: "Sem ficha", area_m2: null, dicofre: null }),
];

const contracts: Contract[] = [
  contract({ id: "c1", property_id: "p1", rent: 400, pf_contract_no: "111" }),
  contract({ id: "c2", property_id: "p2", rent: 600, pf_contract_no: "222" }),
  contract({ id: "c4", property_id: "p4", rent: 300, pf_contract_no: "444" }),
  contract({ id: "c5", property_id: "p5", rent: 310, pf_contract_no: "555",
    status: "cessado", start_date: "2019-01-01", end_date: "2026-03-31" }),
  contract({ id: "c6", property_id: "p6", rent: 250, pf_contract_no: "666" }),
];

const owners: PropertyOwner[] = [
  { property_id: "p1", landlord_id: "L1", quota: 100 },
  // Compropriedade 50/50: a fração conta por INTEIRO para os dois titulares.
  { property_id: "p2", landlord_id: "L1", quota: 50 },
  { property_id: "p2", landlord_id: "L2", quota: 50 },
  { property_id: "p3", landlord_id: "L1", quota: 100 },
  { property_id: "p4", landlord_id: "L2", quota: 100 },
  { property_id: "p5", landlord_id: "L1", quota: 100 },
  { property_id: "p6", landlord_id: "L2", quota: 100 },
];

const payments: Payment[] = [
  ...pagamentos("c1", "2024-01-01", "2026-06-01", 400),
  ...pagamentos("c2", "2024-01-01", "2026-06-01", 450), // retenção de 25%
  ...pagamentos("c4", "2024-01-01", "2025-09-01", 300), // vendida: histórico só
  ...pagamentos("c5", "2024-01-01", "2026-03-01", 310), // cessou em março
  ...pagamentos("c6", "2024-01-01", "2026-04-01", 250), // parou em abril: atraso REAL
];

const expenses: Expense[] = [
  { id: "e1", property_id: "p1", landlord_id: null, expense_date: "2026-04-30",
    category: "imi", amount: 213.4, description: "IMI 2026" },
  { id: "e2", property_id: "p2", landlord_id: null, expense_date: "2026-06-15",
    category: "condominio", amount: 60, description: null },
];

const benchmarks: MarketBenchmark[] = [
  { id: "b1", dicofre: "182341", parish_name: "Viseu", municipality: "Viseu",
    period: "2026T1", rent_median_m2: 7, sale_median_m2: 1500, level: "freguesia", source: "ine" },
];

const raw: RawData = {
  properties, contracts, owners, landlords, benchmarks, payments, expenses,
  rentUpdates: [], coefficients: [{ year: 2026, coefficient: 1.0216 }],
  // c1 já emitiu recibo de julho; c2 e c6 não.
  // os fixtures usam linhas completas, logo servem para os dois campos
  // sem retencao nos fixtures, logo os recibos valem o mesmo que os pagamentos
  receiptsRecentes: payments,
  paymentsRecentes: payments,
  historicoCarregado: true,
  receiptsThisMonth: [{ contract_id: "c1", pf_contract_no: "111" }],
  orphanReceipts: 3,
  insightState: [],
};

const snap = buildSnapshot(raw, TODAY);

// ==========================================================================
// A LÓGICA ANTIGA, copiada expressão por expressão do dashboard da V1
// ==========================================================================
const months = lastMonthsKeys(12, THIS_MONTH);
const propertiesById = new Map(properties.map((p) => [p.id, p]));
const oldCurrentProps = currentProperties(properties);
const oldCurrentIds = new Set(oldCurrentProps.map((p) => p.id));
const oldCurrentContracts = contracts.filter((c) => oldCurrentIds.has(c.property_id));
const oldActive = oldCurrentContracts.filter((c) => c.status === "ativo");

const oldMonthAggs = months.map((m) => {
  const roll = monthRoll(m, oldCurrentContracts, payments, propertiesById);
  const esperado = sum(roll.map((r) => r.expected));
  const recebido = sum(roll.map((r) => r.payment?.amount));
  const despesas = sum(expensesInMonth(expenses, m).map((e) => e.amount));
  return { month: m, esperado, recebido, despesas, liquido: recebido - despesas,
    taxa: esperado > 0 ? recebido / esperado : 0 };
});

const oldArrears = computeArrears(oldActive, payments, TODAY);
const oldOccupiedIds = new Set(oldActive.map((c) => c.property_id));
const oldVacant = oldCurrentProps.filter((p) => !oldOccupiedIds.has(p.id));
const oldOccupancy = oldCurrentProps.length > 0 ? oldOccupiedIds.size / oldCurrentProps.length : 0;
const oldOpenGaps = vacancyGaps(oldCurrentContracts, TODAY_ISO).filter((g) => g.gapEnd === null);
const oldLostRent = sum(oldOpenGaps.map((g) => g.lostRent));
const oldEndingSoon = upcomingContractEnds(oldActive, TODAY_ISO, 90);
const oldMarketRows = oldCurrentProps.map((p) => {
  const active = oldCurrentContracts.find((c) => c.property_id === p.id && c.status === "ativo");
  return { property: p, mv: marketView(p, active, benchmarks) };
});
const oldMarketPotential = sum(oldMarketRows.map((r) => r.mv.gapEurMonth));
const oldBelow = oldMarketRows
  .filter((r) => r.mv.deviation !== null && r.mv.deviation < 0)
  .sort((a, b) => (a.mv.deviation ?? 0) - (b.mv.deviation ?? 0));

// ==========================================================================
// PARIDADE
// ==========================================================================

// A — fluxo mensal: os 12 meses, valor a valor.
{
  assert.equal(snap.fluxo.length, oldMonthAggs.length, "mesmo número de meses");
  snap.fluxo.forEach((novo, i) => {
    const velho = oldMonthAggs[i];
    assert.equal(novo.month, velho.month, `mês ${i}`);
    assert.equal(novo.esperadoContratado, velho.esperado, `esperado em ${velho.month}`);
    assert.equal(novo.recebido, velho.recebido, `recebido em ${velho.month}`);
    assert.equal(novo.despesas, velho.despesas, `despesas em ${velho.month}`);
    assert.equal(novo.liquido, velho.liquido, `líquido em ${velho.month}`);
    assert.equal(novo.taxa, velho.taxa, `taxa em ${velho.month}`);
  });
}

// B — atrasos: as linhas e o resumo têm de ser os MESMOS objetos lógicos.
{
  assert.deepEqual(snap.arrears.rows, oldArrears.rows, "linhas de atrasos idênticas");
  assert.deepEqual(snap.arrears.summary, oldArrears.summary, "resumo de atrasos idêntico");
}

// C — ocupação, vazios e contratos a terminar.
{
  assert.equal(snap.ocupacao.taxa, oldOccupancy, "taxa de ocupação");
  assert.deepEqual(snap.ocupacao.vagas.map((p) => p.id), oldVacant.map((p) => p.id), "frações vagas");
  assert.equal(snap.ocupacao.perdaAtual, oldLostRent, "renda perdida nos vazios em aberto");
  assert.deepEqual(
    snap.contratosATerminar.map((x) => x.contract.id),
    oldEndingSoon.map((c) => c.id),
    "contratos a terminar",
  );
}

// D — mercado.
{
  assert.equal(snap.mercado.potencialMes, oldMarketPotential, "potencial de mercado por mês");
  assert.deepEqual(
    snap.mercado.abaixo.map((a) => a.property.id),
    oldBelow.map((r) => r.property.id),
    "frações abaixo do mercado, na mesma ordem",
  );
  const p1 = snap.ativos.find((a) => a.property.id === "p1");
  assert.deepEqual(p1?.mercado, marketView(properties[0], contracts[0], benchmarks), "marketView de p1");
}

// ==========================================================================
// INVARIANTES DO SNAPSHOT (o que a V1 não tinha, ou tinha errado)
// ==========================================================================

// E — terrenos e vendidos NUNCA entram no universo corrente, mas continuam a existir
// como ativos (o histórico é legítimo e a ficha continua visível).
{
  assert.equal(snap.ativos.length, 6, "as 6 frações existem");
  assert.deepEqual(snap.correntes.map((a) => a.property.id), ["p1", "p2", "p5", "p6"]);
  assert.ok(!snap.correntes.some((a) => a.property.id === "p3"), "terreno fora");
  assert.ok(!snap.correntes.some((a) => a.property.id === "p4"), "vendido fora");
  // O vendido tem pagamentos, e nenhum deles pode aparecer nos atrasos.
  assert.ok(!snap.arrears.rows.some((r) => r.contractId === "c4"), "vendido não gera atraso");
}

// F — a fronteira do conhecido: junho, porque é o último mês com pagamentos.
{
  assert.equal(snap.horizon, "2026-06-01", "fronteira = último mês importado");
  const p1 = snap.ativos.find((a) => a.property.id === "p1")!;
  const julho = p1.faixa.find((c) => c.month === "2026-07-01");
  assert.equal(julho, undefined, "a faixa acaba na fronteira, não inventa meses");
  const junho = p1.faixa.find((c) => c.month === "2026-06-01");
  assert.equal(junho?.status, "pago", "junho está pago");
  // A carteira agregada vai até ao mês corrente, e julho tem de ser `futuro` — nunca falta.
  const carteiraJulho = snap.carteira.find((c) => c.month === "2026-07-01");
  assert.equal(carteiraJulho?.status, "futuro", "julho é por importar, não em falta");
}

// G — retenção na fonte: a renda de referência desce e NÃO há dívida inventada.
{
  assert.equal(snap.expectedByContract["c2"], 450, "referência absorve a retenção de 25%");
  assert.equal(snap.expectedByContract["c1"], 400, "sem retenção, referência = renda");
  const p2 = snap.arrears.rows.find((r) => r.contractId === "c2");
  assert.equal(p2?.debt, 0, "quem paga 450 de 600 todos os meses não tem dívida");
}

// H — o atraso REAL é apanhado: c6 parou em abril, a fronteira é junho, logo 2 meses.
{
  const c6 = snap.arrears.rows.find((r) => r.contractId === "c6");
  assert.equal(c6?.streak, 2, "maio e junho em falta");
  assert.equal(c6?.debt, 500, "2 meses x 250");
}

// I — cobertura: é o órgão de honestidade, tem de contar o que falta.
{
  assert.equal(snap.cobertura.fronteira, "2026-06-01");
  assert.equal(snap.cobertura.senhoriosTotal, 3);
  assert.equal(snap.cobertura.senhoriosModelados, 2, "o Ilidio não tem frações");
  assert.equal(snap.cobertura.fichasIncompletas, 1, "só p6 (p3 é terreno, não conta)");
  assert.equal(snap.cobertura.recibosOrfaos, 3);
}

// J — recibos por emitir: c1 já emitiu; c2 e c6 não. O cessado e o vendido nunca entram.
{
  assert.deepEqual(
    snap.recibosPorEmitir.map((r) => r.contract.id).sort(),
    ["c2", "c6"],
    "só contratos ativos sem recibo do mês",
  );
}

// K — as duas noções de "esperado" coexistem e são DIFERENTES onde têm de ser.
// É a inconsistência que a V1 tinha escondida entre o gráfico do dashboard e o dos
// Atrasos; aqui está explícita, e é isto que permite trocá-la numa linha na Fase 3.
{
  const junho = snap.fluxo.find((m) => m.month === "2026-06-01")!;
  assert.equal(junho.esperadoContratado, 400 + 600 + 250, "soma de contract.rent");
  assert.equal(junho.esperadoReferencia, 400 + 450 + 250, "soma da renda de referência");
  assert.notEqual(junho.esperadoContratado, junho.esperadoReferencia, "e são diferentes");
}

// L — totais.
{
  assert.equal(snap.totais.rendaContratada, 400 + 600 + 250, "só contratos ativos correntes");
  // As 4 frações correntes (p1, p2, p5, p6) têm VPT 50.000 cada. p6 tem ficha incompleta
  // (sem área nem DICOFRE) mas TEM VPT — ficha incompleta não a tira das métricas, só a
  // impede de ter €/m². Fora ficam apenas o terreno (p3) e a vendida (p4).
  assert.equal(snap.totais.vptTotal, 50_000 * 4, "as 4 frações correntes, sem terreno nem vendida");
}

console.log("snapshot.check.ts: OK (paridade A-D, invariantes E-L)");
