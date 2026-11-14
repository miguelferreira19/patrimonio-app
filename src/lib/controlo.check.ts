import assert from "node:assert/strict";
import {
  atrasoDeEmissao, JANELA_DO_CONTROLO_MESES, resumoDoControlo, sinais,
  type ContextoDoControlo, type ContratoDoControlo, type Observacao, type TipoDeSinal,
} from "./controlo";
import { carregarObservacoes } from "./controlo-load";

const contrato: ContratoDoControlo = {
  id: "interno-1", pf_contract_no: "portal-1", tenant_name: "INQUILINO TESTE",
  property_id: "fracao-1", tenant_nif: null, start_date: "2020-01-01", end_date: null,
  rent: 500, due_day: 1, status: "ativo", notes: null, atualizacoes: [], empresa: true,
};
const contexto: ContextoDoControlo = {
  contratos: [contrato], hoje: "2026-11-13",
  ultimoContactoPorContrato: new Map(), mesesEmAtrasoPorContrato: new Map(),
};
function recibo(p: Partial<Observacao> = {}): Observacao {
  return {
    receiptKey: "portal-1/1", contrato: "portal-1", conta: "Conta A",
    periodStart: "2026-10-01", periodEnd: "2026-10-31", receivedDate: "2026-10-01",
    amount: 500, withholding: 125, state: "emitido", firstSeen: "2026-10-05", ...p,
  };
}
function doTipo(tipo: TipoDeSinal, obs: Observacao[], ctx = contexto) {
  return sinais(obs, ctx).filter((s) => s.tipo === tipo);
}
function mensal(mes: string, p: Partial<Observacao> = {}) {
  return recibo({ receiptKey: `portal-1/${mes}`, periodStart: `${mes}-01`,
    periodEnd: `${mes}-28`, receivedDate: `${mes}-01`, firstSeen: null, ...p });
}

assert.equal(JANELA_DO_CONTROLO_MESES, 12);
for (const [mes, dentro] of [["2023-11", false], ["2025-10", false], ["2025-11", false],
  ["2025-12", true], ["2026-09", true], ["2026-11", true], ["2026-12", false]] as const) {
  const o = mensal(mes, { amount: 600, receivedDate: "2020-01-01", firstSeen: contexto.hoje });
  for (const tipo of ["valor_diferente", "emissao_tardia", "data_estranha"] as const) {
    assert.equal(doTipo(tipo, [o]).length, Number(dentro), `${tipo}: período ${mes}`);
  }
  const cancelado = { ...o, state: "anulado" as const };
  assert.equal(doTipo("anulado_sem_substituto", [cancelado]).length, Number(dentro),
    `anulação sem substituto: período ${mes}`);
  assert.equal(doTipo("anulado_reemitido", [cancelado, { ...o, receiptKey: "substituto" }]).length,
    Number(dentro), `anulação com substituto: período ${mes}`);
}
const antigosEmLote = ["2025-09", "2025-10", "2025-11"]
  .map((mes) => mensal(mes, { firstSeen: contexto.hoje }));
assert.equal(doTipo("lote", antigosEmLote).length, 0, "recolha recente não torna os períodos atuais");
assert.equal(doTipo("lote", [...antigosEmLote.slice(0, 2),
  mensal("2026-09", { firstSeen: contexto.hoje })]).length, 0, "histórico não completa um lote recente");
const tocaJanela = recibo({ periodStart: "2025-09-01", periodEnd: "2025-12-31",
  amount: 2000, receivedDate: "2025-09-01", firstSeen: contexto.hoje });
assert.equal(doTipo("emissao_tardia", [tocaJanela]).length, 1, "um mês na janela basta");
const anuladoNaFronteira = { ...tocaJanela, state: "anulado" as const };
assert.equal(doTipo("anulado_sem_substituto", [anuladoNaFronteira]).length, 1);
const substitutosDaFronteira = [mensal("2025-09", { periodEnd: "2025-11-30", amount: 1500 }),
  mensal("2025-12")];
assert.equal(doTipo("anulado_sem_substituto", [anuladoNaFronteira, ...substitutosDaFronteira]).length, 0);
assert.equal(doTipo("anulado_reemitido", [anuladoNaFronteira, ...substitutosDaFronteira])[0].valor, 0,
  "substituto fora da janela continua a cobrir os meses antigos do anulado");

for (const [dias, gravidade] of [[10, 0], [11, 1], [30, 1], [31, 2]]) {
  const firstSeen = new Date(Date.UTC(2026, 9, 1 + dias)).toISOString().slice(0, 10);
  const s = doTipo("emissao_tardia", [recibo({ firstSeen })]);
  assert.equal(s.length, gravidade ? 1 : 0, `emissão com ${dias} dias`);
  if (gravidade) {
    assert.equal(s[0].gravidade, gravidade);
    assert.equal(s[0].dias, dias);
    assert.match(s[0].texto, /precisão de 3 a 4 dias/);
    assert.match(s[0].texto, /segunda.*quinta/);
  }
}
assert.equal(doTipo("emissao_tardia", [recibo({ firstSeen: null })]).length, 0);
assert.equal(doTipo("emissao_tardia", [recibo({ receivedDate: null })]).length, 0);
assert.equal(doTipo("emissao_tardia", [recibo({ firstSeen: "2026-09-30" })]).length, 0);
assert.equal(doTipo("emissao_tardia", [recibo({ state: "anulado", firstSeen: "2026-11-10" })]).length, 0);

const lote = ["2026-08", "2026-09", "2026-10"].map((m) =>
  mensal(m, { firstSeen: "2026-11-02" }));
assert.equal(doTipo("lote", lote.slice(0, 2)).length, 0);
assert.equal(doTipo("lote", lote).length, 1);
assert.equal(doTipo("lote", lote)[0].gravidade, 2);
assert.match(doTipo("lote", lote)[0].texto, /3 meses/);
assert.equal(doTipo("lote", lote.map((r) => ({ ...r, firstSeen: null }))).length, 0);
assert.equal(doTipo("lote", lote.map((r) => ({ ...r,
  periodStart: "2026-10-01", periodEnd: "2026-10-31" }))).length, 0);
assert.equal(doTipo("lote", lote.map((r, i) => ({ ...r, contrato: `c${i}` }))).length, 0);
assert.equal(doTipo("lote", lote.map((r, i) => ({ ...r, firstSeen: `2026-11-0${i + 1}` }))).length, 0);
assert.equal(doTipo("lote", [...lote.slice(0, 2), lote[0]]).length, 0);

const anulado = recibo({ state: "anulado", firstSeen: "2026-11-05" });
const substituto = recibo({ receiptKey: "portal-1/2" });
assert.equal(doTipo("anulado_sem_substituto", [anulado]).length, 1);
assert.equal(doTipo("anulado_sem_substituto", [anulado])[0].gravidade, 3);
assert.match(doTipo("anulado_sem_substituto", [anulado])[0].texto, /voltou a estar por pagar/);
assert.equal(doTipo("anulado_sem_substituto", [anulado, substituto]).length, 0);
assert.equal(doTipo("anulado_sem_substituto", [anulado, recibo()]).length, 1);
assert.equal(doTipo("anulado_sem_substituto", [anulado, { ...substituto, contrato: "outro" }]).length, 1);
assert.equal(doTipo("anulado_sem_substituto", [anulado, mensal("2026-09")]).length, 1);
assert.equal(doTipo("anulado_reemitido", [anulado]).length, 0);
for (const [diferenca, gravidade] of [[0, 1], [1, 1], [1.01, 2], [-1.01, 2]]) {
  const s = doTipo("anulado_reemitido", [anulado, { ...substituto, amount: 500 + diferenca }]);
  assert.equal(s.length, 1);
  assert.equal(s[0].valor, diferenca);
  assert.equal(s[0].gravidade, gravidade);
}
assert.equal(doTipo("anulado_sem_substituto", [anulado, substituto,
  { ...substituto, state: "anulado" }]).length, 2, "um substituto também anulado não paga o mês");
const substitutoLongo = recibo({ ...substituto, periodStart: "2026-09-01", amount: 1000 });
assert.equal(doTipo("anulado_reemitido", [anulado, substitutoLongo])[0].valor, 0);
const anuladoLongo = { ...anulado, periodStart: "2026-09-01", amount: 1000 };
assert.equal(doTipo("anulado_sem_substituto", [anuladoLongo, substituto]).length, 1);

for (const diferenca of [1, 1.01, -1, -1.01]) {
  const s = doTipo("valor_diferente", [recibo({ amount: 500 + diferenca })]);
  assert.equal(s.length, Math.abs(diferenca) > 1 ? 1 : 0);
  if (s.length) assert.equal(s[0].valor, diferenca);
}
assert.equal(doTipo("valor_diferente", [recibo({ amount: 200 }),
  { ...substituto, amount: 300 }]).length, 0, "pagamento em partes soma a renda");
assert.equal(doTipo("valor_diferente", [recibo({ amount: 200 }),
  { ...substituto, amount: 301 }]).length, 0, "a tolerância também vale para a soma");
assert.equal(doTipo("valor_diferente", [recibo({ amount: 200 }),
  { ...substituto, amount: 200 }]).length, 2, "soma mensal diferente assinala os dois recibos");
assert.equal(doTipo("valor_diferente", [substitutoLongo]).length, 0);
assert.equal(doTipo("valor_diferente", [{ ...substitutoLongo, amount: 999.99 }]).length, 0);
assert.equal(doTipo("valor_diferente", [anulado, recibo({ amount: 400 })]).length, 0);
const atualizado = { ...contrato, rent: 550, atualizacoes: [{ id: "u1", contract_id: contrato.id,
  effective_date: "2026-10-01", old_rent: 500, new_rent: 550, reason: "coeficiente" as const }] };
assert.equal(doTipo("valor_diferente", [mensal("2026-09"), mensal("2026-10", { amount: 550 })],
  { ...contexto, contratos: [atualizado] }).length, 0);
assert.equal(doTipo("valor_diferente", [mensal("2026-10")],
  { ...contexto, contratos: [atualizado] }).length, 0, "renda anterior aceite no mês da atualização");
assert.equal(doTipo("valor_diferente", [mensal("2026-11")],
  { ...contexto, contratos: [atualizado] })[0].valor, -50, "exceção não passa ao mês seguinte");
assert.equal(doTipo("valor_diferente", [mensal("2026-10", { amount: 499 })],
  { ...contexto, contratos: [atualizado] }).length, 0, "tolerância de 1 euro na renda anterior");
assert.equal(doTipo("valor_diferente", [mensal("2026-10", { amount: 498.99 })],
  { ...contexto, contratos: [atualizado] }).length, 1, "valor diferente de ambas as rendas");
const duasAtualizacoes = { ...atualizado, rent: 600, atualizacoes: [
  { ...atualizado.atualizacoes[0], id: "u2", effective_date: "2026-11-01", old_rent: 550, new_rent: 600 },
  atualizado.atualizacoes[0],
] };
const ctxAtualizado = { ...contexto, contratos: [duasAtualizacoes] };
assert.equal(doTipo("valor_diferente", [mensal("2026-10", { amount: 550 })], ctxAtualizado).length, 0,
  "renda histórica usa a atualização do mês e não a renda atual");
assert.equal(doTipo("valor_diferente", [mensal("2026-11", { amount: 550 })], ctxAtualizado).length, 0);
assert.equal(doTipo("valor_diferente", [mensal("2026-11")], ctxAtualizado).length, 1,
  "só a renda imediatamente anterior à última atualização beneficia da exceção");
const semRendaAnterior = { ...atualizado,
  atualizacoes: [{ ...atualizado.atualizacoes[0], old_rent: null }] };
assert.equal(doTipo("valor_diferente", [mensal("2026-10")],
  { ...contexto, contratos: [semRendaAnterior] }).length, 1, "sem renda anterior não se inventa exceção");

const semRetencao = mensal("2026-09", { withholding: 0 });
assert.equal(doTipo("retencao_inconsistente", [recibo(), semRetencao]).length, 1);
assert.equal(doTipo("retencao_inconsistente", [recibo(), semRetencao])[0].gravidade, 2);
assert.equal(doTipo("retencao_inconsistente", [recibo(), mensal("2026-09")]).length, 0);
assert.equal(doTipo("retencao_inconsistente", [semRetencao]).length, 0);
assert.equal(doTipo("retencao_inconsistente", [recibo(),
  mensal("2025-11", { withholding: 0 })]).length, 0, "fora dos últimos 12 meses");
assert.equal(doTipo("retencao_inconsistente", [recibo(),
  mensal("2025-12", { withholding: 0 })]).length, 1, "primeiro mês da janela incluído");
assert.equal(doTipo("retencao_inconsistente", [recibo(),
  mensal("2026-12", { withholding: 0 })]).length, 0, "mês futuro excluído");
assert.equal(doTipo("retencao_inconsistente", [recibo(), { ...semRetencao, contrato: "outro" }]).length, 0);
assert.equal(doTipo("retencao_inconsistente", [recibo(), { ...semRetencao, state: "anulado" }]).length, 0);

const salto = [mensal("2026-08"), mensal("2026-10")];
assert.deepEqual(doTipo("mes_saltado", salto).map((s) => s.id), ["mes_saltado:portal-1:2026-09-01"]);
assert.equal(doTipo("mes_saltado", salto)[0].gravidade, 2);
assert.equal(doTipo("mes_saltado", [...salto, mensal("2026-09")]).length, 0);
assert.equal(doTipo("mes_saltado", [mensal("2026-08"), mensal("2026-09")]).length, 0);
assert.equal(doTipo("mes_saltado", [mensal("2025-09"), mensal("2025-11")]).length, 0);
assert.equal(doTipo("mes_saltado", [mensal("2026-10"), mensal("2026-12")]).length, 0);
assert.equal(doTipo("mes_saltado", [{ ...substitutoLongo, periodStart: "2026-08-01", amount: 1500 }]).length, 0);
assert.equal(doTipo("mes_saltado", [...salto, mensal("2026-09"),
  mensal("2026-09", { state: "anulado" })]).length, 1);

for (const [receivedDate, n] of [["2026-11-13", 0], ["2026-11-14", 1],
  ["2026-08-31", 0], ["2026-08-30", 1], [null, 0]] as const) {
  const s = doTipo("data_estranha", [recibo({ receivedDate })]);
  assert.equal(s.length, n, `data de recebimento ${receivedDate}`);
  if (n) assert.equal(s[0].gravidade, 1);
}
assert.equal(doTipo("data_estranha", [recibo({ receivedDate: "2026-11-14" }),
  recibo({ state: "anulado", receivedDate: "2026-11-14" })]).length, 1);

for (const [meses, contacto, gravidade] of [
  [1, undefined, 0], [2, undefined, 2], [3, undefined, 2], [4, undefined, 3],
  [2, "2026-10-14", 0], [2, "2026-10-13", 2], [2, "2026-11-13", 0],
  [2, "2026-11-14", 2],
] as const) {
  const ctx = { ...contexto, mesesEmAtrasoPorContrato: new Map([[contrato.id, meses]]),
    ultimoContactoPorContrato: new Map(contacto ? [[contrato.id, contacto]] : []) };
  const s = doTipo("atraso_sem_contacto", [recibo()], ctx);
  assert.equal(s.length, gravidade ? 1 : 0, `${meses} meses, contacto ${contacto}`);
  if (gravidade) assert.equal(s[0].gravidade, gravidade);
}
const atraso = { ...contexto, mesesEmAtrasoPorContrato: new Map([[contrato.id, 4]]) };
assert.equal(doTipo("atraso_sem_contacto", [], atraso).length, 1, "não exige observações");

assert.deepEqual(sinais([], contexto), []);
assert.deepEqual(resumoDoControlo([]), { emissao_tardia: 0, lote: 0, anulado_sem_substituto: 0,
  anulado_reemitido: 0, valor_diferente: 0, retencao_inconsistente: 0, mes_saltado: 0,
  data_estranha: 0, atraso_sem_contacto: 0 });
const todos = [...lote, anulado, recibo({ firstSeen: "2026-11-05", amount: 550 }),
  mensal("2026-06", { withholding: 0 }), recibo({ receiptKey: "futuro", receivedDate: "2026-12-01" })];
const antes = JSON.stringify(todos);
const resultado = sinais(todos, atraso);
assert.equal(JSON.stringify(todos), antes, "não altera observações");
assert.deepEqual(sinais([...todos].reverse(), atraso), resultado, "ordem de entrada não muda sinais nem ids");
assert.deepEqual(sinais([...todos, ...todos], atraso), resultado, "observações repetidas não duplicam factos");
assert.equal(new Set(resultado.map((s) => s.id)).size, resultado.length);
assert.equal(Object.values(resumoDoControlo(resultado)).reduce((a, b) => a + b, 0), resultado.length);
for (let i = 1; i < resultado.length; i++) {
  const a = resultado[i - 1], b = resultado[i];
  assert.ok(a.gravidade > b.gravidade || (a.gravidade === b.gravidade && a.dia >= b.dia));
}
for (const s of resultado) {
  assert.equal(s.inquilino, "Inquilino Teste");
  assert.equal(s.conta, "Conta A");
  assert.ok(!/[—–]/.test(s.texto));
}

const medicoes = [recibo(), recibo({ receiptKey: "b", firstSeen: "2026-10-11" }),
  recibo({ receiptKey: "c", firstSeen: "2026-09-30" }),
  recibo({ receiptKey: "d", firstSeen: null }), recibo({ receiptKey: "e", receivedDate: null }),
  recibo({ receiptKey: "f", firstSeen: "2026-10-07" }),
  recibo({ receiptKey: "g", conta: "Conta B", firstSeen: null }), anulado];
const medianas = atrasoDeEmissao(medicoes);
assert.deepEqual(medianas.porConta.get("Conta A"), { mediana: 5, n: 4, semMedicao: 2 });
assert.deepEqual(medianas.porConta.get("Conta B"), { mediana: 0, n: 0, semMedicao: 1 });
assert.deepEqual(medianas.porContrato.get("portal-1"), { mediana: 5, n: 4 });
assert.equal(atrasoDeEmissao([]).porConta.size, 0);
assert.equal(atrasoDeEmissao([]).porContrato.size, 0);
assert.deepEqual(atrasoDeEmissao([recibo({ firstSeen: null })]).porContrato.get("portal-1"),
  { mediana: 0, n: 0 });

type Erro = { code: string; message: string };
type Linha = {
  receipt_key: string; pf_contract_no: string; account: string; period_start: string | null;
  period_end: string | null; received_date: string | null; amount: string;
  withholding: string; state: "emitido"; first_seen: string | null;
};
const linha: Linha = { receipt_key: "portal-1/1", pf_contract_no: "portal-1", account: "Conta A",
  period_start: "2026-10-01", period_end: "2026-10-31", received_date: "2026-10-01",
  amount: "500.00", withholding: "125.00", state: "emitido", first_seen: "2026-10-05" };
function fonte(rows: Linha[], error: Erro | null = null, falharNaPagina = -1) {
  const paginas: number[] = [];
  const consulta = {
    select: () => consulta,
    order: (coluna: string) => { assert.equal(coluna, "id"); return consulta; },
    range: async (de: number, ate: number) => {
      paginas.push(de);
      const falha = falharNaPagina < 0 || de >= falharNaPagina;
      return { data: error && falha ? null : rows.slice(de, ate + 1), error: falha ? error : null };
    },
  };
  const supabase = { from: (tabela: string) => {
    assert.equal(tabela, "receipt_observations"); return consulta;
  } } as unknown as Parameters<typeof carregarObservacoes>[0];
  return { supabase, paginas };
}
async function verificarCarga() {
  const f = fonte(Array.from({ length: 1001 }, (_, i) => ({ ...linha, receipt_key: `r${i}` })));
  const r = await carregarObservacoes(f.supabase);
  assert.equal(r.tabelaEmFalta, false);
  assert.equal(r.observacoes.length, 1001);
  assert.deepEqual(f.paginas, [0, 1000]);
  assert.deepEqual(r.observacoes[0], recibo({ receiptKey: "r0" }));
  const vazia = await carregarObservacoes(fonte([]).supabase);
  assert.deepEqual(vazia, { observacoes: [], tabelaEmFalta: false });
  for (const code of ["42P01", "PGRST205"]) {
    const erro = { code, message: "A tabela public.receipt_observations não existe" };
    assert.deepEqual(await carregarObservacoes(fonte([], erro).supabase),
      { observacoes: [], tabelaEmFalta: true });
  }
  for (const code of ["42501", "PGRST204", "08006"]) {
    await assert.rejects(carregarObservacoes(fonte([], { code, message: "falha sintética" }).supabase),
      /receipt_observations.*falha sintética/);
  }
  const parcial = fonte(Array.from({ length: 1000 }, () => linha),
    { code: "42501", message: "segunda página falhou" }, 1000);
  await assert.rejects(carregarObservacoes(parcial.supabase), /receipt_observations.*segunda página/);
  await assert.rejects(carregarObservacoes(fonte([], { code: "42P01",
    message: "A tabela outra_tabela não existe" }).supabase), /receipt_observations.*outra_tabela/);
  const transporte = { from: () => { throw new Error("transporte indisponível"); } } as unknown as
    Parameters<typeof carregarObservacoes>[0];
  await assert.rejects(carregarObservacoes(transporte), /receipt_observations.*transporte indisponível/);
  const semDatas = await carregarObservacoes(fonte([{ ...linha, period_start: null,
    period_end: null, first_seen: null, received_date: null }]).supabase);
  assert.equal(semDatas.observacoes[0].periodStart, "");
  assert.equal(semDatas.observacoes[0].periodEnd, "");
  assert.deepEqual(sinais(semDatas.observacoes, contexto), []);
  console.log("controlo: sinais, limites, medianas e carregamento OK");
}
void verificarCarga();
