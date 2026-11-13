import assert from "node:assert/strict";
import { contarPorGravidade, problemasDaFracao, problemasPorPredio } from "./problemas";
import type { CasoAberto, DespesaAnual, EntradaDeProblemas, TipoDeProblema } from "./problemas";
import { buildSnapshot } from "./snapshot";
import type { RawData } from "./load";
import type { Contract, Expense, Property } from "../types";
import { monthLabel } from "../format";

const HOJE = "2026-11-13";
const fracao = (over: Partial<Property> = {}): Property => ({
  id: "p", name: "Casa de teste", address: null, postal_code: null, municipality: null,
  parish: null, dicofre: null, typology: "T2", area_m2: 60, vpt: 50000,
  vpt_year: 2025, matriz_article: "123456-U-10-A", status: "arrendado", notes: null, ...over,
});
const contrato = (over: Partial<Contract> = {}): Contract => ({
  id: "c", property_id: "p", tenant_name: "Pessoa de teste", tenant_nif: null,
  pf_contract_no: null, start_date: "2026-02-01", end_date: null, rent: 400,
  due_day: 1, status: "ativo", notes: null, term_kind: "sem_termo", ...over,
});
const pagamento = (contract_id: string, ref_month: string, amount = 400) => ({
  contract_id, ref_month, amount, received_date: ref_month,
});
const caso = (over: Partial<CasoAberto> = {}): CasoAberto => ({
  id: "avaria", property_id: "p", kind: "manutencao", title: "Reparar canalização",
  status: "aberto", priority: "normal", ...over,
});
const despesa = (over: Partial<Expense> = {}): DespesaAnual => ({
  id: "despesa", property_id: "p", landlord_id: null, category: "imi",
  expense_date: "2024-12-31", amount: 200, description: null, origem: "registada", ...over,
});
function entrada(
  raw: Partial<RawData> = {}, casos: CasoAberto[] = [], despesas: DespesaAnual[] = [], hoje = HOJE,
): EntradaDeProblemas {
  const snap = buildSnapshot({
    properties: [fracao()], contracts: [contrato()], owners: [], landlords: [], benchmarks: [],
    payments: [pagamento("c", "2026-10-01")], paymentsRecentes: [], expenses: [], rentUpdates: [],
    coefficients: [{ year: 2026, coefficient: 1.02 }], receiptsThisMonth: [], receiptsRecentes: [],
    orphanReceipts: 0, insightState: [], historicoCarregado: true, ...raw,
  }, new Date(`${hoje}T12:00:00Z`));
  return { snap, casos, despesas, hoje };
}
const doTipo = (e: EntradaDeProblemas, tipo: TipoDeProblema, id = "p") =>
  problemasDaFracao(id, e).filter((p) => p.tipo === tipo);
function diaDaquiA(dias: number): string {
  const d = new Date(`${HOJE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

assert.deepEqual(problemasDaFracao("p", entrada()), [], "fração sem problemas");
assert.deepEqual(problemasDaFracao("inexistente", entrada()), []);
assert.deepEqual(problemasPorPredio(entrada({ properties: [], contracts: [] })), new Map());

function comAtraso(meses: 2 | 3): EntradaDeProblemas {
  return entrada({
    properties: [fracao(), fracao({ id: "controlo", matriz_article: "123456-U-20" })],
    contracts: [contrato(), contrato({ id: "cc", property_id: "controlo" })],
    payments: [pagamento("c", meses === 2 ? "2026-08-01" : "2026-07-01"), pagamento("cc", "2026-10-01")],
  });
}
for (const meses of [2, 3] as const) {
  const [p] = doTipo(comAtraso(meses), "em_atraso");
  assert.ok(p);
  assert.equal(p.gravidade, meses === 3 ? 3 : 2);
  assert.equal(p.valor, meses * 400);
  assert.equal(p.texto, `Em atraso: ${meses} meses`);
}
assert.deepEqual(doTipo(entrada(), "em_atraso"), []);
const ritmo = comAtraso(3);
ritmo.snap.arrears.rows.find((r) => r.contractId === "c")!.severity = "ritmo_proprio";
assert.deepEqual(doTipo(ritmo, "em_atraso"), [], "reutiliza a exclusão de cadência própria");

function vaga(fim: string | null, over: Partial<Property> = {}): EntradaDeProblemas {
  return entrada({
    properties: [fracao({ status: "vago", ...over })],
    contracts: fim ? [contrato({ status: "cessado", end_date: fim })] : [],
  });
}
for (const [fim, gravidade] of [["2026-05-31", 2], ["2026-04-30", 3]] as const) {
  const [p] = doTipo(vaga(fim), "vaga");
  assert.ok(p);
  assert.equal(p.gravidade, gravidade, "5 meses e 6 meses de vaga");
  assert.equal(p.valor, 4800);
  assert.ok(p.desde);
  assert.ok(p.texto.includes(monthLabel(p.desde)), "mês apresentado por monthLabel");
}
assert.equal(doTipo(vaga("2026-05-13"), "vaga")[0].gravidade, 2, "falta um dia para seis meses");
assert.equal(doTipo(vaga("2026-05-12"), "vaga")[0].gravidade, 3, "seis meses de calendário exatos");
for (const typology of ["Garagem", "Arrecadação", "Arrecadacao"]) {
  assert.equal(doTipo(vaga("2025-01-31", { typology }), "vaga")[0].gravidade, 1);
}
assert.equal(doTipo(vaga("2025-01-31", { typology: "Loja" }), "vaga")[0].gravidade, 2);
assert.equal(doTipo(vaga("2025-01-31", { typology: null }), "vaga")[0].gravidade, 2);
for (const over of [{ status: "terreno" }, { status: "vendido" }, { matriz_article: "123456-R-10" }] as const) {
  assert.deepEqual(doTipo(vaga("2025-01-31", over), "vaga"), []);
}
assert.deepEqual(doTipo(entrada(), "vaga"), []);
const semHistorico = vaga(null);
semHistorico.snap.ativos[0].mercado.benchmarkRentM2 = 10;
const [semRenda] = doTipo(semHistorico, "vaga");
assert.equal(semRenda.valor, undefined, "não inventa renda a partir do mercado");
assert.equal(semRenda.desde, undefined, "não inventa o início da vaga");
assert.equal(semRenda.gravidade, 2);

const atualizavel = entrada({ contracts: [contrato({ start_date: "2025-11-13" })] });
const [parada] = doTipo(atualizavel, "renda_parada");
assert.ok(parada);
assert.equal(parada.gravidade, 1);
assert.equal(parada.valor, 96);
assert.equal(parada.desde, "2026-11-13");
assert.deepEqual(doTipo(entrada({ contracts: [contrato({ start_date: "2025-11-14" })] }), "renda_parada"), []);
for (const coefficient of [1, 0.99]) {
  assert.deepEqual(doTipo(entrada({
    contracts: [contrato({ start_date: "2025-01-01" })], coefficients: [{ year: 2026, coefficient }],
  }), "renda_parada"), []);
}
assert.deepEqual(doTipo(vaga("2025-01-31"), "renda_parada"), []);

for (const dias of [119, 120, 121]) {
  const data = diaDaquiA(dias);
  for (const prazo of [{ end_date: data }, { term_kind: "prazo_certo", expected_end_date: data }] as const) {
    const ps = doTipo(entrada({ contracts: [contrato(prazo)] }), "contrato_a_terminar");
    assert.equal(ps.length, dias <= 120 ? 1 : 0, `${dias} dias até ao termo`);
    if (ps[0]) {
      assert.equal(ps[0].gravidade, 2);
      assert.ok(ps[0].texto.includes(monthLabel(data)));
    }
  }
}
assert.equal(doTipo(entrada({ contracts: [contrato({ end_date: HOJE })] }), "contrato_a_terminar").length, 1);
assert.deepEqual(doTipo(entrada({ contracts: [contrato({ end_date: diaDaquiA(-1) })] }), "contrato_a_terminar"), []);
assert.deepEqual(doTipo(entrada(), "contrato_a_terminar"), []);
assert.deepEqual(doTipo(vaga(diaDaquiA(119)), "contrato_a_terminar"), []);

for (const term_kind of [undefined, "desconhecido"] as const) {
  const [p] = doTipo(entrada({ contracts: [contrato({ term_kind })] }), "prazo_desconhecido");
  assert.ok(p);
  assert.equal(p.gravidade, 1);
}
for (const prazo of [
  { term_kind: "sem_termo" },
  { term_kind: "prazo_certo", expected_end_date: "2028-01-01" },
  { term_kind: "prazo_certo", duration_months: 24 },
  { end_date: "2028-01-01", term_kind: undefined },
] as const) {
  assert.deepEqual(doTipo(entrada({ contracts: [contrato(prazo)] }), "prazo_desconhecido"), []);
}
assert.deepEqual(doTipo(entrada({
  properties: [fracao({ typology: "Loja" })], contracts: [contrato({ term_kind: "desconhecido" })],
}), "prazo_desconhecido"), []);
assert.deepEqual(doTipo(vaga(null), "prazo_desconhecido"), []);

for (const priority of ["baixa", "normal", "alta", "urgente"] as const) {
  for (const status of ["aberto", "em_curso", "adiado"] as const) {
    const [p] = doTipo(entrada({}, [caso({ priority, status })]), "avaria");
    assert.ok(p);
    assert.equal(p.gravidade, priority === "alta" || priority === "urgente" ? 3 : 2);
    assert.equal(p.texto, "Reparar canalização");
    assert.equal(p.href, "/gestao/avaria");
  }
}
for (const over of [{ status: "concluido" }, { kind: "tarefa" }, { property_id: "outra" }] as const) {
  assert.deepEqual(doTipo(entrada({}, [caso(over)]), "avaria"), []);
}

for (const category of ["imi", "condominio", "seguro"] as const) {
  const anterior = despesa({ category });
  const atual = despesa({ category, expense_date: "2025-12-31", amount: 250 });
  const [p] = doTipo(entrada({}, [], [anterior]), "despesa_em_falta");
  assert.ok(p);
  assert.equal(p.gravidade, 1);
  assert.equal(p.valor, 200);
  assert.ok(p.texto.includes("2025"));
  assert.deepEqual(doTipo(entrada({}, [], [anterior, atual]), "despesa_em_falta"), []);
  assert.deepEqual(doTipo(entrada({}, [], [atual]), "despesa_em_falta"), []);
  for (const origem of ["espelhada", "estimada"] as const) {
    assert.deepEqual(doTipo(entrada({}, [], [{ ...anterior, origem }]), "despesa_em_falta"), []);
    assert.equal(doTipo(entrada({}, [], [anterior, { ...atual, origem }]), "despesa_em_falta").length, 1);
  }
}
for (const category of ["obras", "conservacao", "financiamento", "outras"] as const) {
  assert.deepEqual(doTipo(entrada({}, [], [despesa({ category })]), "despesa_em_falta"), []);
}
for (const over of [
  { expense_date: "2023-12-31" }, { expense_date: "2026-01-01" },
  { property_id: "outra" }, { property_id: null },
]) {
  assert.deepEqual(doTipo(entrada({}, [], [despesa(over)]), "despesa_em_falta"), []);
}
assert.equal(doTipo(entrada({}, [], [despesa(), despesa({ amount: 50 })]), "despesa_em_falta")[0].valor, 250);
assert.equal(doTipo(entrada({}, [], [despesa({
  expense_date: "2025-01-01",
})], "2027-01-01"), "despesa_em_falta").length, 1, "o ano fechado muda em janeiro");
const coproprietarios = entrada({
  landlords: [
    { id: "l1", name: "Titular A", nif: null, notes: null },
    { id: "l2", name: "Titular B", nif: null, notes: null },
  ],
  owners: [{ property_id: "p", landlord_id: "l1", quota: 50 }, { property_id: "p", landlord_id: "l2", quota: 50 }],
}, [], [despesa({ landlord_id: "l1", amount: 100 }), despesa({ landlord_id: "l2", amount: 100 })]);
assert.equal(doTipo(coproprietarios, "despesa_em_falta")[0].valor, 200, "sem duplicar IMI de comproprietários");
const umTitular = { ...coproprietarios, despesas: [coproprietarios.despesas[0]] };
assert.equal(doTipo(umTitular, "despesa_em_falta")[0].valor, 200, "reconstrói o valor por inteiro");

const conjunto = comAtraso(3);
conjunto.casos = [caso(), caso({ id: "grave", priority: "urgente", title: "Reparar telhado" })];
conjunto.despesas = [despesa(), despesa({ category: "condominio", amount: 500 })];
const antes = JSON.stringify(conjunto);
const ps = problemasDaFracao("p", conjunto);
assert.deepEqual(ps.map((p) => [p.tipo, p.gravidade, p.valor]), [
  ["em_atraso", 3, 1200], ["avaria", 3, undefined], ["avaria", 2, undefined],
  ["despesa_em_falta", 1, 500], ["despesa_em_falta", 1, 200],
]);
assert.deepEqual(contarPorGravidade(ps), { g3: 2, g2: 1, g1: 2 });
assert.deepEqual(contarPorGravidade([]), { g3: 0, g2: 0, g1: 0 });
assert.equal(JSON.stringify(conjunto), antes, "não altera a entrada");
assert.deepEqual(problemasDaFracao("p", conjunto), ps, "resultado determinístico");
assert.ok(ps.every((p) => !/[€—]|undefined|NaN/.test(p.texto)));

const agrupavel = entrada({
  properties: [fracao(), fracao({ id: "b", matriz_article: "123456-U-10-B" }), fracao({ id: "isolada", matriz_article: null })],
  contracts: [contrato(), contrato({ id: "cb", property_id: "b" }), contrato({ id: "ci", property_id: "isolada" })],
  payments: [pagamento("c", "2026-10-01"), pagamento("cb", "2026-10-01"), pagamento("ci", "2026-10-01")],
}, [caso()], [despesa({ property_id: "b", amount: 600 })]);
const porPredio = problemasPorPredio(agrupavel);
assert.equal(porPredio.size, 2);
assert.deepEqual(porPredio.get("123456-U-10"), [
  ...problemasDaFracao("p", agrupavel), ...problemasDaFracao("b", agrupavel),
]);
assert.deepEqual(porPredio.get("fracao:isolada"), [], "inclui prédio sem problemas");
const ordemPredio = entrada({
  properties: [fracao(), fracao({ id: "b", matriz_article: "123456-U-10-B" })],
  contracts: [contrato(), contrato({ id: "cb", property_id: "b" })],
  payments: [pagamento("c", "2026-10-01"), pagamento("cb", "2026-10-01")],
}, [caso(), caso({ id: "urgente", property_id: "b", priority: "alta" })]);
assert.deepEqual(problemasPorPredio(ordemPredio).get("123456-U-10")!.map((p) => p.gravidade), [3, 2]);
const valoresPredio = entrada({
  properties: [fracao(), fracao({ id: "b", matriz_article: "123456-U-10-B" })],
  contracts: [contrato(), contrato({ id: "cb", property_id: "b" })],
  payments: [pagamento("c", "2026-10-01"), pagamento("cb", "2026-10-01")],
}, [], [despesa(), despesa({ property_id: "b", amount: 600 })]);
assert.deepEqual(problemasPorPredio(valoresPredio).get("123456-U-10")!.map((p) => p.valor), [600, 200]);

console.log("problemas.check.ts: OK (7 tipos, limites, valores por inteiro, agrupamento e ordenação)");
