// SSR e consultas simuladas: não abre sessão, rede nem ficheiros de dados pessoais.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const raiz = process.cwd();
const original = Module._load;
let contexto;
const botao = (nome) => (props) => React.createElement("button", { "data-form": nome }, props.label || nome);
Module._load = function (nome, parent, main) {
  if (nome === "next/link") return ({ children, ...props }) => React.createElement("a", props, children);
  if (nome === "next/navigation") return { notFound: () => { throw new Error("404"); } };
  if (nome === "@/lib/data") return { getSession: async () => contexto.sessao };
  if (nome === "@/lib/portfolio") return {
    getSnapshot: async () => contexto.snap,
    getSnapshotComRaw: async () => ({ ...contexto, today: new Date("2026-11-13T12:00:00Z") }),
  };
  if (nome === "@/lib/portfolio/load") return { fetchGeoOptions: async () => [] };
  if (nome === "@/components/forms") return Object.fromEntries([
    "ContractFormButton", "DeleteContractButton", "DeletePropertyButton", "EndContractButton",
    "ExpenseFormButton", "PropertyFormButton", "RentUpdateButton",
  ].map((n) => [n, botao(n)]));
  if (nome === "@/components/gestao/forms") return { QuotaEvidence: botao("QuotaEvidence") };
  if (nome === "@/components/documentos/carregar") return { Carregar: botao("Carregar") };
  if (nome === "@/components/documentos/lista") return {
    lerArquivo: async () => ({ docs: contexto.docs || [] }), ListaDocumentos: () => null,
  };
  if (nome === "@/components/faixa/faixa") return { Faixa: ({ linhas }) => React.createElement("div", { "data-historico": linhas[0].nome }) };
  if (nome.endsWith("/modal")) return { Modal: () => null };
  return original.call(this, nome.startsWith("@/") ? path.join(raiz, "src", nome.slice(2)) : nome, parent, main);
};
for (const extensao of [".ts", ".tsx"]) require.extensions[extensao] = (modulo, ficheiro) => {
  const resultado = ts.transpileModule(fs.readFileSync(ficheiro, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: ficheiro,
  });
  modulo._compile(resultado.outputText, ficheiro);
};

function cliente(tabelas, erroEm) {
  const consultas = [];
  return { consultas, from(tabela) {
    const filtros = []; const ordens = [];
    const q = {
      select() { return q; }, eq(k, v) { filtros.push((r) => r[k] === v); return q; },
      neq(k, v) { filtros.push((r) => r[k] !== v); return q; },
      gte(k, v) { filtros.push((r) => r[k] >= v); return q; },
      lt(k, v) { filtros.push((r) => r[k] < v); return q; },
      lte(k, v) { filtros.push((r) => r[k] <= v); return q; },
      order(k, opts) { ordens.push([k, opts?.ascending === false ? -1 : 1]); return q; },
      range(de, ate) {
        consultas.push({ tabela, de, ate });
        if (tabela === erroEm) return Promise.resolve({ data: null, error: { message: "falha sintética" } });
        const dados = (tabelas[tabela] || []).filter((r) => filtros.every((f) => f(r)));
        dados.sort((a, b) => {
          for (const [k, sinal] of ordens) { const c = String(a[k]).localeCompare(String(b[k])); if (c) return c * sinal; }
          return 0;
        });
        return Promise.resolve({ data: dados.slice(de, ate + 1), error: null });
      },
    };
    return q;
  } };
}

const propriedade = (id, nome, artigo, status = "arrendado") => ({
  id, name: nome, matriz_article: artigo, status, address: null, postal_code: null,
  municipality: null, parish: null, dicofre: null, typology: "T2", area_m2: 60,
  vpt: 50000, vpt_year: 2025, notes: null,
});
const contrato = (id, property_id) => ({
  id, property_id, tenant_name: "PESSOA DE TESTE", tenant_nif: null, pf_contract_no: null,
  start_date: "2026-01-01", end_date: null, rent: 400, due_day: 1, status: "ativo",
  notes: null, term_kind: "sem_termo",
});
const despesa = (id, expense_date) => ({
  id, property_id: "p", expense_date, category: "imi", amount: 50,
  landlord_id: null, description: null, origem: "registada",
});
const caso = (id, over = {}) => ({
  id, property_id: "p", kind: "manutencao", status: "aberto", priority: "alta",
  title: "Canalização urgente", ...over,
});
function preparar(admin = false, vazio = false, over = {}) {
  const raw = {
    properties: vazio ? [] : [propriedade("p", "Zulu", "123456-U-10-A"), propriedade("v", "Vaga", "123456-U-20-A", "vago"), propriedade("a", "Alfa", "123456-U-30-A")],
    contracts: vazio ? [] : [contrato("c", "p"), contrato("cc", "a")],
    owners: [], landlords: [], benchmarks: [], expenses: [], rentUpdates: [], coefficients: [],
    payments: vazio ? [] : [{ contract_id: "c", ref_month: "2026-10-01", amount: 400, received_date: null }, { contract_id: "cc", ref_month: "2026-10-01", amount: 400, received_date: null }],
    paymentsRecentes: [], receiptsRecentes: [], receiptsThisMonth: [],
    insightState: [], historicoCarregado: true, orphanReceipts: 0, ...over,
  };
  const { buildSnapshot } = require("../../lib/portfolio/snapshot.ts");
  const snap = buildSnapshot(raw, new Date("2026-11-13T12:00:00Z"));
  const supabase = cliente({ management_cases: vazio ? [] : [caso("avaria")], expenses: raw.expenses });
  contexto = { raw, snap, sessao: { supabase, isAdmin: admin, isGestor: admin, user: { id: "sintetico" } } };
}

async function verificarLoader() {
  const { carregarEntradaDeProblemas } = require("../../lib/portfolio/problemas-load.ts");
  preparar();
  const casos = Array.from({ length: 1001 }, (_, i) => caso(String(i).padStart(4, "0")));
  const despesas = Array.from({ length: 1001 }, (_, i) => despesa(String(i).padStart(4, "0"), i % 2 ? "2024-01-01" : "2025-12-31"));
  const c = cliente({ management_cases: [...casos, caso("feito", { status: "concluido" }), caso("outro", { kind: "cobranca" })], expenses: [...despesas, despesa("antiga", "2023-12-31"), despesa("atual", "2026-01-01")] });
  const entrada = await carregarEntradaDeProblemas(c, contexto.snap, "2026-11-13");
  assert.equal(entrada.snap, contexto.snap);
  assert.equal(entrada.hoje, "2026-11-13");
  assert.equal(entrada.casos.length, 1001);
  assert.equal(entrada.despesas.length, 1001);
  assert.equal(c.consultas.length, 4, "pagina as duas tabelas acima de mil linhas");
  for (const tabela of ["management_cases", "expenses"]) await assert.rejects(
    carregarEntradaDeProblemas(cliente({}, tabela), contexto.snap, "2026-11-13"), new RegExp(tabela),
  );
}

async function pagina(caminho, props) {
  return renderToStaticMarkup(await require(path.join(raiz, "src/app/(app)", caminho, "page.tsx")).default(props));
}
async function verificarPaginas() {
  preparar();
  const todos = await pagina("imoveis", { searchParams: Promise.resolve({}) });
  assert.match(todos, /3 prédios · 3 frações · 1 vaga<\/p>/);
  assert.match(todos, /Com problemas/);
  assert.match(todos, /Canalização urgente/);
  assert.ok(todos.indexOf("Zulu") < todos.indexOf("Alfa"), "gravidade primeiro");
  assert.doesNotMatch(todos, /Valor patrimonial|MesesLegenda|PropertyFormButton/);
  const filtrada = await pagina("imoveis", { searchParams: Promise.resolve({ ver: "problemas" }) });
  assert.doesNotMatch(filtrada, />Alfa</);
  const vagas = await pagina("imoveis", { searchParams: Promise.resolve({ ver: "vagos" }) });
  assert.doesNotMatch(vagas, />Zulu</);
  assert.match(vagas, /\/imoveis\/123456-U-20/);
  const predio = await pagina("imoveis/[chave]", { params: Promise.resolve({ chave: "123456-U-10" }), searchParams: Promise.resolve({}) });
  assert.match(predio, /Problemas/); assert.match(predio, /\/gestao\/avaria/);
  assert.match(predio, /Pessoa de Teste/); assert.match(predio, /celula-in/);
  assert.doesNotMatch(predio, />Em atraso</, "sem caixa de atraso quando a dívida é zero");
  await assert.rejects(pagina("imoveis/[chave]", { params: Promise.resolve({ chave: "inexistente" }), searchParams: Promise.resolve({}) }), /404/);
  preparar(false, true);
  assert.match(await pagina("imoveis", { searchParams: Promise.resolve({}) }), /class="vazio/);
}

async function verificarGravidadeUm() {
  preparar(false, false, { contracts: [
    { ...contrato("c", "p"), term_kind: "desconhecido" },
    contrato("cc", "a"),
  ] });
  contexto.sessao.supabase = cliente({ management_cases: [], expenses: [] });
  const { prediosComProblemas } = require("./modelo.ts");
  const lista = prediosComProblemas({ snap: contexto.snap, hoje: "2026-11-13", casos: [], despesas: [] });
  assert.equal(lista.filter((p) => p.comProblemas).length, 1);
  assert.ok(lista[0].problemas.some((p) => p.gravidade >= 2));
  assert.deepEqual(lista.slice(1).map((p) => p.nome), ["Alfa", "Zulu"], "gravidade 1 não ordena como problema");
  const html = await pagina("imoveis", { searchParams: Promise.resolve({ ver: "problemas" }) });
  assert.doesNotMatch(html, />Alfa<|>Zulu</);
  const todos = await pagina("imoveis", { searchParams: Promise.resolve({}) });
  assert.match(todos, /1 a acompanhar/);
  preparar(false, false, { payments: [
    { contract_id: "c", ref_month: "2026-09-01", amount: 400, received_date: null },
    { contract_id: "cc", ref_month: "2026-10-01", amount: 400, received_date: null },
  ] });
  const predio = await pagina("imoveis/[chave]", { params: Promise.resolve({ chave: "123456-U-10" }), searchParams: Promise.resolve({}) });
  assert.match(predio, />Em atraso</, "a dívida positiva conserva a caixa");
}

async function verificarFracao() {
  for (const admin of [false, true]) for (const tab of ["resumo", "pagamentos", "contrato", "documentos", "despesas"]) {
    preparar(admin);
    const resultado = await pagina("fracoes/[id]", { params: Promise.resolve({ id: "p" }), searchParams: Promise.resolve({ tab }) });
    for (const rotulo of ["Resumo", "Pagamentos", "Contrato", "Documentos", "Despesas"]) assert.ok(resultado.includes(rotulo));
    assert.match(resultado, /\/inquilinos\//);
    assert.ok(resultado.indexOf("Problemas") < resultado.indexOf('aria-label="Secções da fração"'));
    for (const nome of ["PropertyFormButton", "DeletePropertyButton", "EndContractButton", "QuotaEvidence"]) assert.equal(resultado.includes('data-form="' + nome + '"'), admin, nome);
    if (tab === "documentos") assert.equal(resultado.includes('data-form="Carregar"'), admin);
    if (tab === "despesas") assert.equal(resultado.includes('data-form="ExpenseFormButton"'), admin);
    if (tab === "contrato") assert.equal(resultado.includes('data-form="DeleteContractButton"'), admin);
  }
}

function verificarHistorico() {
  const { buildContractHistory } = require("../fracao/historico.ts");
  const c = { ...contrato("h", "p"), start_date: "2024-01-01", rent: 600 };
  const pagamentos = [{ contract_id: "h", ref_month: "2025-10-01", amount: 450 }, { contract_id: "h", ref_month: "2026-01-01", amount: 450 }];
  const h = buildContractHistory(c, pagamentos, "2026-10-01", 2026);
  assert.deepEqual(h.years.map((y) => y.year), [2024, 2025, 2026]);
  assert.equal(h.years[2].months[0].status, "pago", "retenção preservada");
  assert.equal(h.years[2].months[0].expected, 450);
  assert.equal(h.years[2].months[10].status, "futuro", "não inventa atraso depois da fronteira");
  assert.equal(h.years[2].totalReceived, 450);
  const terminado = buildContractHistory({ ...c, end_date: "2025-12-31" }, pagamentos, "2026-10-01", 2026);
  assert.ok(terminado.years[2].months.every((m) => m.status === "fora"));
  const { tiraDaFracao } = require("./modelo.ts");
  preparar();
  assert.equal(tiraDaFracao(contexto.snap.ativos[0], contexto.snap).at(-1).estado, "por_receber");
  assert.ok(tiraDaFracao(contexto.snap.ativos[1], contexto.snap).every((m) => m.estado === "fora"));
}

async function verificarEstadosEspeciais() {
  preparar(false, false, { landlords: [{ id: "l", name: "Senhorio de teste" }],
    receiptsRecentes: [{ contract_id: "c", ref_month: "2026-07-01", issue_date: "2026-07-02", landlord_id: "l", amount: 400 }],
  });
  const props = { params: Promise.resolve({ id: "p" }), searchParams: Promise.resolve({}) };
  const parada = await pagina("fracoes/[id]", props);
  assert.match(parada, /Sem informação/);
  assert.doesNotMatch(parada, />Em dia</);
  for (const [status, rotulo] of [["terreno", "Terreno"], ["vendido", "Vendida"]]) {
    preparar(false, false, { properties: [propriedade("p", "Casa de teste", "123456-U-10", status)], contracts: [] });
    const resultado = await pagina("fracoes/[id]", props);
    assert.ok(resultado.includes(rotulo));
    assert.doesNotMatch(resultado, />Vaga</);
  }
  preparar();
  await assert.rejects(pagina("fracoes/[id]", { params: Promise.resolve({ id: "inexistente" }), searchParams: Promise.resolve({}) }), /404/);
  const semProblemas = await pagina("fracoes/[id]", { params: Promise.resolve({ id: "a" }), searchParams: Promise.resolve({ tab: "invalido", voltar: "//externo.test" }) });
  assert.doesNotMatch(semProblemas, />Problemas</);
  assert.match(semProblemas, /href="\/imoveis"/);
}

async function main() {
  await verificarLoader(); verificarHistorico(); await verificarPaginas(); await verificarGravidadeUm();
  await verificarFracao(); await verificarEstadosEspeciais();
  console.log("OK: T32, loader paginado, anos civis fechados, falhas visíveis, filtros, ordem, problemas e cinco separadores (SSR sintético).");
}
main().catch((erro) => { console.error(erro); process.exitCode = 1; });
