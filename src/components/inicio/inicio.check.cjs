const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const original = Module._load;
const raiz = process.cwd();
let contexto;
Module._load = function (nome, parent, main) {
  if (nome === "next/link") return ({ children, ...props }) => React.createElement("a", props, children);
  if (nome === "@/lib/data") return { getSession: async () => ({ isAdmin: contexto.admin, isGestor: contexto.gestor, supabase: {} }) };
  if (nome === "@/lib/portfolio") return { getSnapshotComRaw: async () => contexto };
  if (nome === "@/lib/portfolio/diario-load") return { carregarFontesDoDiario: async () => contexto.fontes };
  if (nome === "@/lib/portfolio/recolha-load") return { carregarCorridasDaRecolha: async () => [] };
  return original.call(this, nome.startsWith("@/") ? path.join(raiz, "src", nome.slice(2)) : nome, parent, main);
};
for (const extensao of [".ts", ".tsx"]) require.extensions[extensao] = (modulo, ficheiro) => {
  const compilado = ts.transpileModule(fs.readFileSync(ficheiro, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: ficheiro,
  });
  modulo._compile(compilado.outputText, ficheiro);
};
const { selecionarRendas, correspondeAoNome } = require("../rendas/filtros.ts");
const { tarefasDoInicio } = require("./tarefas.ts");
const { buildSnapshot } = require("../../lib/portfolio/snapshot.ts");

function ensaio(atraso = false, vazio = false) {
  const contract = { id: "c1", property_id: "p1", tenant_name: "JOÃO SILVA", tenant_nif: null,
    pf_contract_no: null, start_date: "2025-01-01", end_date: null, rent: 500, status: "ativo", due_day: 1 };
  const pagos = Array.from({ length: 13 }, (_, i) => {
    const data = new Date(Date.UTC(2025, 10 + i, 1)).toISOString().slice(0, 10);
    return { id: data, contract_id: "c1", ref_month: data, amount: 500, received_date: data,
      method: "transferencia", source: "recibo", notes: null };
  }).filter((p) => !atraso || p.ref_month < "2026-10-01");
  const ancora = { ...contract, id: "c2", property_id: "p2", tenant_name: "Maria" };
  const todos = [...pagos, ...Array.from({ length: 13 }, (_, i) => ({ ...pagos[0],
    id: `ancora${i}`, contract_id: "c2", ref_month: new Date(Date.UTC(2025, 10 + i, 1)).toISOString().slice(0, 10),
  }))];
  const raw = { properties: vazio ? [] : ["p1", "p2"].map((id) => ({ id, name: "Rua do Ensaio", status: "arrendado", typology: "T2" })),
    contracts: vazio ? [] : [contract, ancora], payments: vazio ? [] : todos, paymentsRecentes: vazio ? [] : todos,
    receiptsRecentes: [], receiptsThisMonth: [], landlords: [], owners: [], expenses: [], benchmarks: [],
    rentUpdates: [], coefficients: [], insightState: [], orphanReceipts: 0, historicoCarregado: true };
  return { raw, snap: buildSnapshot(raw, new Date("2026-11-13T12:00:00Z")), admin: false, gestor: true,
    fontes: { eventos: [], movimentos: [], recibos: [] } };
}

function verificarFiltros() {
  const linhas = [
    { chave: "a", nome: "João Silva", estado: "em_atraso", aVigiar: [] },
    { chave: "b", nome: "Maria", estado: "por_receber", aVigiar: ["paga tarde"] },
    { chave: "c", nome: "Ana", estado: "paga", aVigiar: [] },
  ];
  assert.equal(selecionarRendas(linhas).ativo, "em_atraso");
  assert.equal(selecionarRendas(linhas.slice(1)).ativo, "por_receber");
  assert.equal(selecionarRendas([], "invalido").ativo, "por_receber");
  assert.deepEqual(selecionarRendas(linhas, "a_vigiar").linhas.map((l) => l.chave), ["b"]);
  assert.deepEqual(selecionarRendas(linhas, "paga", true).linhas, linhas);
  assert.equal(selecionarRendas(linhas, "sem_informacao").pilulas.find((p) => p.id === "sem_informacao").n, 0);
  assert.ok(!selecionarRendas(linhas).pilulas.some((p) => p.id === "sem_informacao"));
  assert.ok(correspondeAoNome("João Silva", "  JOAO sil  "));
  assert.ok(!correspondeAoNome("João Silva", "Maria"));
}

function verificarTarefas() {
  const { snap } = ensaio(true);
  assert.equal(snap.arrears.rows.find((r) => r.contractId === "c1").debt, 500, "dívida sintética de um mês");
  const promessa = { id: "p", contratoId: "c1", tipo: "promessa", dia: "2026-11-01", texto: "Pagarei",
    prometidoPara: "2026-11-10", valor: 500, autor: null };
  const prazos = Array.from({ length: 4 }, (_, i) => ({ id: `prazo${i}`, dia: `2026-11-${20 + i}`,
    titulo: "IMI", valor: 50, estimado: true, feito: false, tipo: "imi", senhorio: null }));
  const tarefas = tarefasDoInicio(snap, [promessa], prazos, false);
  assert.match(tarefas[0].titulo, /Enviar lembrete a João Silva/);
  assert.match(tarefas[1].titulo, /Promessa.*João Silva/);
  assert.equal(tarefas.length, 5);
  assert.equal(tarefas[2].estimado, true);
  const carta = { ...promessa, id: "carta", tipo: "carta", dia: "2026-11-10", texto: "lembrete: Lembrete enviado" };
  assert.ok(!tarefasDoInicio(snap, [carta], [], false).some((t) => /Enviar/.test(t.titulo)), "aguarda os 15 dias");
  carta.dia = "2026-10-20";
  assert.match(tarefasDoInicio(snap, [carta], [], false)[0].titulo, /Enviar interpelação/);
  assert.equal(tarefasDoInicio(ensaio().snap, [], [], false).length, 0);
  assert.ok(tarefasDoInicio(ensaio().snap, [], [], true).length > 0, "fila só para admin");
  assert.match(tarefasDoInicio(ensaio().snap, [], [], true)[0].href, /^https:\/\/.+portaldasfinancas/,
    "a tarefa liga diretamente à sua ação principal");
}

async function verificarPaginas() {
  const inicio = require("../../app/(app)/page.tsx").default;
  const rendas = require("../../app/(app)/rendas/page.tsx").default;
  contexto = ensaio(true);
  let html = renderToStaticMarkup(await inicio());
  assert.match(html, /1 inquilino em atraso/);
  assert.match(html, /Ver quem deve/);
  assert.match(html, /Leitura de recibos por configurar/);
  assert.match(html, />500\s*<span class="money-minor/, "total em atraso no Início");
  assert.doesNotMatch(html, /Oportunidades|FluxoMensal/);
  html = renderToStaticMarkup(await rendas({ searchParams: Promise.resolve({ registar: "1", estado: "paga" }) }));
  assert.match(html, /Escolhe o inquilino/);
  assert.match(html, />500\s*<span class="money-minor/, "o mesmo total em atraso em Rendas");
  assert.match(html, /inquilinos\/nome%3Ajoao%20silva\?registar=1/);
  assert.doesNotMatch(html, /Extrato mês a mês/);
  contexto.gestor = false;
  html = renderToStaticMarkup(await rendas({ searchParams: Promise.resolve({ registar: "1" }) }));
  assert.doesNotMatch(html, /Escolhe o inquilino|\?registar=1/);
  contexto = ensaio();
  html = renderToStaticMarkup(await inicio());
  assert.match(html, /Tudo em dia/);
  assert.doesNotMatch(html, /Ver quem deve|Quem deve/);
  contexto.admin = true;
  html = renderToStaticMarkup(await rendas({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Extrato mês a mês/);
  contexto = ensaio(false, true);
  assert.match(renderToStaticMarkup(await inicio()), /class="vazio"/);
  assert.match(renderToStaticMarkup(await rendas({ searchParams: Promise.resolve({}) })), /vazio/);
}

async function verificarFonteParada() {
  contexto = ensaio();
  const raw = contexto.raw;
  raw.landlords = [{ id: "avo", name: "Miguel" }, { id: "outro", name: "António" }];
  raw.payments = raw.payments.filter((p) => p.contract_id !== "c1" || p.ref_month <= "2026-07-01");
  raw.paymentsRecentes = raw.payments;
  raw.receiptsRecentes = [
    { contract_id: "c1", landlord_id: "avo", issue_date: "2026-07-02", ref_month: "2026-07-01", amount: 500 },
    { contract_id: "c2", landlord_id: "outro", issue_date: "2026-11-05", ref_month: "2026-11-01", amount: 500 },
  ];
  contexto.snap = buildSnapshot(raw, new Date("2026-11-13T12:00:00Z"));
  const inicio = require("../../app/(app)/page.tsx").default;
  const html = renderToStaticMarkup(await inicio());
  assert.match(html, /Herança do avô/);
  assert.match(html, /desde jul 2026/);
  assert.match(html, /rendas\?estado=sem_informacao/);
}

verificarFiltros();
verificarTarefas();
verificarPaginas().then(verificarFonteParada)
  .then(() => console.log("OK: Início e Rendas, totais, fontes, filtros, pesquisa, cartas, prioridade, registar e vazios (SSR sintético)."))
  .catch((erro) => { console.error(erro); process.exitCode = 1; });
