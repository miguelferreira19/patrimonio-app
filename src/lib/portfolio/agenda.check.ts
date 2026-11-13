// Self-check de agenda.ts. Corre com `npm run check`.
import assert from "node:assert/strict";
import {
  construirAgenda, prazosDeRenda, prazosFiscais, prazosDoAno, proximosPrazos,
  type RendaAtualizavel,
} from "./agenda";
import type { Expense, Landlord } from "../types";

const renda = (o: Partial<RendaAtualizavel>): RendaAtualizavel => ({
  contractId: "c1",
  fracao: "R. das Flores 12",
  inquilino: "Ana",
  renda: 800,
  elegivelDesde: "2026-12-01",
  rendaSugerida: 817.28,
  ...o,
});

// A. O calendário fiscal de um ano: IMI em maio, agosto e novembro, IRS a 30 de junho, e o
//    AIMI só aparece quando há imposto a pagar.
{
  const p = prazosFiscais(2026);
  assert.deepEqual(
    p.map((x) => x.data),
    ["2026-05-31", "2026-06-30", "2026-08-31", "2026-11-30"],
  );
  assert.ok(p.find((x) => x.id === "irs-2026")!.titulo.includes("IRS 2025"));
  const comAimi = prazosFiscais(2026, [{ senhorio: "Miguel", valor: 1234.5 }, { senhorio: "Eva", valor: 0 }]);
  const aimi = comAimi.find((x) => x.id === "aimi-2026")!;
  assert.equal(aimi.data, "2026-09-30");
  assert.equal(aimi.euros, 1234.5, "só soma quem paga");
  assert.ok(!aimi.detalhe.includes("Eva"), "quem não paga AIMI não aparece");
}

// B. A carta sai 30 dias antes da elegibilidade.
{
  const [p] = prazosDeRenda([renda({})], "2026-10-03", "2027-01-31");
  assert.equal(p.data, "2026-11-01");
  assert.equal(p.href, "/carta/c1");
  assert.ok(Math.abs(p.euros! - 207.36) < 0.01, "ganho anual = (sugerida − atual) × 12");
}

// C. Faltam menos de 30 dias: o prazo é HOJE, não uma data que já passou.
{
  const [p] = prazosDeRenda([renda({ elegivelDesde: "2026-10-20" })], "2026-10-03", "2027-01-31");
  assert.equal(p.data, "2026-10-03");
}

// D. Já elegível: está na fila do Agora, não se repete aqui. Renda que não sobe também não.
{
  assert.equal(prazosDeRenda([renda({ elegivelDesde: "2026-09-01" })], "2026-10-03", "2027-01-31").length, 0);
  assert.equal(prazosDeRenda([renda({ rendaSugerida: 790 })], "2026-10-03", "2027-01-31").length, 0);
  // Sem coeficiente do ano ainda se avisa, mas sem euros inventados.
  const [semCoef] = prazosDeRenda([renda({ rendaSugerida: null })], "2026-10-03", "2027-01-31");
  assert.equal(semCoef.euros, null);
  assert.equal(semCoef.confianca, "assumido");
}

// E. A janela atravessa o fim do ano e vem por ordem de data.
{
  const a = construirAgenda({ hoje: "2026-10-03", dias: 240, rendas: [renda({})], aimi: [] });
  assert.deepEqual(
    a.map((p) => p.id),
    ["renda-c1-2026-12-01", "imi-3-2026", "imi-1-2027"],
  );
  const datas = a.map((p) => p.data);
  assert.deepEqual(datas, [...datas].sort());
}

const senhorio = (id: string, name = id): Landlord => ({ id, name, nif: null, notes: null });
const despesa = (amount: number, o: Partial<Expense> = {}): Expense => ({
  id: "d1", property_id: "p1", landlord_id: "s1", expense_date: "2025-12-31",
  category: "imi", amount, description: null, origem: "registada", ...o,
});
const entrada = (despesas: Expense[] = []) => ({
  ano: 2026, hoje: "2026-01-01", despesas, senhorios: [senhorio("s1", "Ana")],
  aimi: [], rendas: [], feitos: new Set<string>(),
});

// F. Limites das prestações e acerto de cêntimos na última.
for (const [total, esperado] of [
  [90, [90]], [100, [100]], [100.01, [50, 50.01]], [300, [150, 150]],
  [500, [250, 250]], [500.01, [166.67, 166.67, 166.67]],
  [900, [300, 300, 300]], [1000, [333.33, 333.33, 333.34]],
] as Array<[number, number[]]>) {
  const prazos = prazosDoAno(entrada([despesa(total)])).filter((p) => p.tipo === "imi");
  assert.deepEqual(prazos.map((p) => p.valor), esperado, `IMI de ${total}`);
  assert.deepEqual(prazos.map((p) => p.dia), esperado.length === 1 ? ["2026-05-31"] :
    esperado.length === 2 ? ["2026-05-31", "2026-11-30"] :
      ["2026-05-31", "2026-08-31", "2026-11-30"]);
  assert.ok(prazos.every((p) => p.estimado && p.nota === "Estimativa pelo IMI do ano anterior."));
}

// G. O ano anterior e a parte de cada titular, sem confundir ausência com zero.
{
  const e = entrada([despesa(300), despesa(120, { landlord_id: "s2" }),
    despesa(9000, { expense_date: "2026-01-01" }), despesa(9000, { category: "obras" }),
    despesa(9000, { origem: "estimada" }), despesa(9000, { origem: "espelhada" })]);
  e.senhorios.push(senhorio("s2", "Bia"), senhorio("s3", "Carla"));
  const prazos = prazosDoAno(e).filter((p) => p.tipo === "imi");
  assert.deepEqual(prazos.filter((p) => p.senhorio === "Ana").map((p) => p.valor), [150, 150]);
  assert.deepEqual(prazos.filter((p) => p.senhorio === "Bia").map((p) => p.valor), [60, 60]);
  assert.deepEqual(prazos.filter((p) => p.senhorio === "Carla").map((p) => p.valor), [null]);
  assert.equal(new Set(prazos.map((p) => p.id)).size, prazos.length);
  assert.deepEqual(prazosDoAno({ ...e, senhorios: [...e.senhorios].reverse() }), prazosDoAno(e));
  const familiar = entrada([despesa(1000, { landlord_id: null }), despesa(90)]);
  const imi = prazosDoAno({ ...familiar, titulares: [
    { landlord_id: "s1", property_id: "p1", quota: 25 },
  ] }).filter((p) => p.tipo === "imi");
  assert.deepEqual(imi.map((p) => p.valor), [170, 170], "a despesa própria não volta a levar quota");
  assert.equal(prazosDoAno(entrada([despesa(1000, { landlord_id: null })]))
    .find((p) => p.tipo === "imi")!.valor, null, "sem quotas não inventa a parte da família");
  assert.equal(prazosDoAno(entrada([despesa(0)])).find((p) => p.tipo === "imi")!.valor, 0);
}

// H. AIMI positivo, duas obrigações de IRS e feitos excluídos dos próximos.
{
  const e = { ...entrada([despesa(90)]), aimi: [
    { senhorio: "Ana", valor: 123.45 }, { senhorio: "Bia", valor: 0 },
    { senhorio: "Carla", valor: -1 },
  ] };
  const prazos = prazosDoAno(e);
  const aimi = prazos.filter((p) => p.tipo === "aimi");
  assert.deepEqual(aimi.map((p) => [p.dia, p.valor, p.senhorio, p.estimado]),
    [["2026-09-30", 123.45, "Ana", true]]);
  assert.deepEqual(prazos.filter((p) => p.tipo === "irs").map((p) => [p.dia, p.titulo, p.valor]), [
    ["2026-06-30", "IRS: entregar a declaração (Anexo F)", null],
    ["2026-08-31", "IRS: pagamento", null],
  ]);
  const id = prazos.find((p) => p.tipo === "imi")!.id;
  const marcados = prazosDoAno({ ...e, feitos: new Set([id]) });
  assert.equal(marcados.find((p) => p.id === id)!.feito, true);
  assert.ok(!proximosPrazos(marcados, "2026-01-01", 10).some((p) => p.id === id));
  assert.deepEqual(proximosPrazos([...prazos].reverse(), "2026-08-31", 1),
    prazos.filter((p) => p.dia === "2026-08-31"));
  assert.deepEqual(proximosPrazos(prazos, "2026-01-01", 0), []);
  assert.deepEqual(proximosPrazos(prazos, "2026-01-01", -1), []);
  assert.deepEqual(prazosDoAno({ ...e, senhorios: [...e.senhorios].reverse() }), prazos);
}

// I. Rendas conservam as regras existentes; herança só no ano e titular indicados.
{
  const e = { ...entrada(), hoje: "2026-10-03", rendas: [renda({})] };
  const [p] = prazosDoAno(e).filter((p) => p.tipo === "renda");
  const [antigo] = prazosDeRenda(e.rendas, e.hoje, "2026-12-31");
  assert.deepEqual([p.id, p.dia, p.valor], [antigo.id, antigo.data, antigo.euros]);
  const heranca = { ...entrada(), senhorios: [senhorio("h1", "Herança de Teste")] };
  assert.equal(prazosDoAno(heranca).filter((p) => p.tipo === "heranca").length, 0);
  const ano2027 = prazosDoAno({ ...heranca, ano: 2027 });
  const [h] = ano2027.filter((p) => p.tipo === "heranca");
  assert.deepEqual([h.dia, h.titulo, h.valor, h.senhorio],
    ["2027-06-30", "IRS do ano do óbito: declaração do falecido", null, "Herança de Teste"]);
  const chaves = ano2027.map((p) => `${p.dia}:${p.titulo}`);
  assert.deepEqual(chaves, [...chaves].sort((a, b) => a.localeCompare(b)));
  assert.equal(prazosDoAno({ ...entrada(), ano: 2027 }).filter((p) => p.tipo === "heranca").length, 0);
}

console.log("agenda.check.ts: OK (A a I)");
