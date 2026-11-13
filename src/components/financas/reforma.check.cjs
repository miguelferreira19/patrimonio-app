const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const raiz = path.resolve(__dirname, "../../..");
const cache = new Map();

function carregar(ficheiro, mocks = {}) {
  const absoluto = path.join(raiz, ficheiro);
  if (!Object.keys(mocks).length && cache.has(absoluto)) return cache.get(absoluto);
  const fonte = fs.readFileSync(absoluto, "utf8");
  const js = ts.transpileModule(fonte, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const modulo = { exports: {} };
  const importar = (nome) => {
    if (nome in mocks) return mocks[nome];
    if (!nome.startsWith(".") && !nome.startsWith("@/")) return require(nome);
    const destino = nome.startsWith("@/") ? path.join(raiz, "src", nome.slice(2)) :
      path.resolve(path.dirname(absoluto), nome);
    const ext = [".ts", ".tsx", "/index.ts"].find((e) => fs.existsSync(destino + e));
    return carregar(path.relative(raiz, destino + ext), mocks);
  };
  new Function("require", "module", "exports", js)(importar, modulo, modulo.exports);
  if (!Object.keys(mocks).length) cache.set(absoluto, modulo.exports);
  return modulo.exports;
}

function calendario() {
  const m = carregar("src/components/financas/modelo.ts");
  const prazo = (id, dia, valor, estimado = false, feito = false) =>
    ({ id, dia, valor, estimado, feito, titulo: id, senhorio: null, tipo: "imi" });
  const prazos = [prazo("passado", "2026-11-12", 999), prazo("hoje", "2026-11-13", null),
    prazo("estimado", "2026-12-01", 100.12, true), prazo("feito", "2026-12-02", 999, false, true),
    prazo("90dias", "2027-02-11", 20.23), prazo("91dias", "2027-02-12", 999),
    prazo("ultimo", "2027-10-31", 10), prazo("fora", "2027-11-01", 999)];
  const c = m.calendarioVisivel(prazos, "2026-11-13");
  assert.equal(c.meses.length, 12);
  assert.equal(c.meses[0].mes, "2026-11-01");
  assert.equal(c.meses.at(-1).mes, "2027-10-01");
  assert.deepEqual(c.meses.flatMap((g) => g.prazos.map((p) => p.id)),
    ["hoje", "estimado", "feito", "90dias", "91dias", "ultimo"]);
  assert.equal(c.proximo.id, "hoje");
  assert.equal(c.valor90Dias, 120.35);
  assert.equal(c.incluiEstimativas, true);
  assert.equal(m.calendarioVisivel([], "2026-12-31").proximo, null);
  const estados = [{ kind: "prazo", subject: "hoje", dismissed_at: "2026-11-13" },
    { kind: "controlo", subject: "outro", dismissed_at: "2026-11-13" }];
  assert.deepEqual([...m.prazosFeitos(estados)], ["hoje"]);
  assert.equal(m.separadorFinanceiro("mercado"), "resultado");
  assert.equal(m.separadorFinanceiro("impostos"), "impostos");
  assert.equal(m.separadorFinanceiro("desconhecido"), "resultado");
  assert.equal(m.destinoImpostos({ ano: "2025", senhorio: "a b" }),
    "/financas?tab=impostos&ano=2025&senhorio=a+b");
}

function controlo() {
  const m = carregar("src/components/controlo/modelo.ts");
  const contrato = { id: "c1", pf_contract_no: "pf1", tenant_name: "Oficina Azul, Lda", tenant_nif: null };
  const atualizacao = { contract_id: "c1", new_rent: 510 };
  const diario = [{ contratoId: "c1", tipo: "nota", dia: "2026-11-13" },
    { contratoId: "c1", tipo: "contacto", dia: "2026-10-05" }];
  const ctx = m.contextoDoControlo([contrato], [atualizacao],
    [{ contratos: [{ contract: contrato, meses: 3 }] }], diario, "2026-11-13");
  assert.equal(ctx.contratos[0].empresa, true);
  assert.deepEqual(ctx.contratos[0].atualizacoes, [atualizacao]);
  assert.equal(ctx.mesesEmAtrasoPorContrato.get("c1"), 3);
  assert.equal(ctx.ultimoContactoPorContrato.get("c1"), "2026-10-05");
  for (const nif of ["512345678", "612345678", "912345678"]) {
    assert.equal(m.eEmpresa({ tenant_nif: nif, tenant_name: "Azul" }), true);
  }
  for (const nome of ["Azul, Lda.", "Azul S.A.", "Azul Unipessoal"]) {
    assert.equal(m.eEmpresa({ tenant_nif: null, tenant_name: nome }), true);
  }
  assert.equal(m.eEmpresa({ tenant_nif: "212345678", tenant_name: "Joana Silva" }), false);
  const sinais = [{ id: "a", tipo: "emissao_tardia" }, { id: "b", tipo: "anulado_reemitido" },
    { id: "c", tipo: "atraso_sem_contacto" }, { id: "d", tipo: "valor_diferente" }];
  const estados = [{ kind: "controlo", subject: "a", dismissed_at: "2026-11-13", note: "Visto" },
    { kind: "controlo", subject: "b", dismissed_at: "2026-11-13", note: "Justificado" },
    { kind: "prazo", subject: "c", dismissed_at: "2026-11-13" }];
  const lista = m.listaDeSinais(sinais, estados, "por_ver");
  assert.deepEqual(lista.visiveis.map((s) => s.id), ["c", "d"]);
  assert.equal(lista.contagens.emissao, 1);
  assert.equal(lista.contagens.anulados, 1);
  assert.equal(lista.estados.get("b"), "Justificado");
  assert.deepEqual(m.listaDeSinais(sinais, estados, "emissao").visiveis.map((s) => s.id), ["a"]);
  assert.equal(m.ligacaoDoContrato("pf1", [contrato]), "/inquilinos/nome%3Aoficina%20azul%2C%20lda");
  assert.equal(m.ligacaoDoContrato("desconhecido", [contrato]), undefined);
}

async function autorizacao() {
  for (const [role, isAdmin] of [["viewer", false], ["gestor", false], ["viewer", true]]) {
    let leituras = 0;
    const pagina = carregar("src/app/(app)/controlo/page.tsx", {
      "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
      "@/lib/data": { getSession: async () => ({ role, isAdmin }) },
      "@/lib/controlo-load": { carregarObservacoes: async () => { leituras++; } },
      "@/components/controlo/painel": { default: () => null },
      "@/components/controlo/carregar": { carregarControlo: async () => { leituras++; } },
    });
    await assert.rejects(() => pagina.default({ searchParams: Promise.resolve({}) }), /redirect:\//);
    assert.equal(leituras, 0);
  }
  let leituras = 0;
  const vazio = () => null;
  const pagina = carregar("src/app/(app)/controlo/page.tsx", {
    "next/navigation": { redirect: () => { throw new Error("redirect inesperado"); } },
    "@/lib/data": { getSession: async () => ({ role: "admin", isAdmin: true }) },
    "@/lib/controlo-load": { carregarObservacoes: async () => ({ tabelaEmFalta: true }) },
    "@/components/ui": { EmptyState: vazio },
    "@/components/controlo/painel": { default: () => null },
    "@/components/controlo/carregar": { carregarControlo: async () => { leituras++; } },
  });
  const resultado = await pagina.default({ searchParams: Promise.resolve({}) });
  assert.equal(resultado.type, vazio);
  assert.match(resultado.props.children, /depois de aplicar a migração e da primeira recolha/);
  assert.equal(leituras, 0);
}

function elementos(no) {
  if (!no || typeof no !== "object") return [];
  if (Array.isArray(no)) return no.flatMap(elementos);
  return [no, ...elementos(no.props?.children)];
}

async function separadores() {
  const kit = Object.fromEntries(["Lede", "Pilulas"].map((n) => [n, () => null]));
  const mocks = { "@/components/kit": kit };
  const componentes = ["impostos/ano", "financas/resultado", "financas/calendario", "financas/poupanca",
    "rentabilidade/mercado", "rentabilidade/despesas", "rentabilidade/projecao"];
  for (const nome of componentes) mocks[`@/components/${nome}`] = { default: () => null };
  const tipo = (nome) => mocks[`@/components/${nome}`].default;
  for (const isAdmin of [false, true]) {
    mocks["@/lib/data"] = { getSession: async () => ({ isAdmin }) };
    const pagina = carregar("src/app/(app)/financas/page.tsx", mocks).default;
    for (const tab of [undefined, "mercado", "despesas", "projecao"]) {
      const nos = elementos(await pagina({ searchParams: Promise.resolve({ tab }) }));
      assert(nos.some((n) => n.type === tipo("financas/resultado")));
      assert.equal(nos.some((n) => n.type === tipo("rentabilidade/despesas")), isAdmin);
      assert.equal(nos.some((n) => n.type === tipo("rentabilidade/projecao")), isAdmin);
      assert(nos.some((n) => n.type === tipo("rentabilidade/mercado")));
      const abertos = nos.filter((n) => n.type === "details" && n.props.open);
      assert.equal(abertos.length, tab && (isAdmin || tab === "mercado") ? 1 : 0);
    }
    const nos = elementos(await pagina({ searchParams: Promise.resolve({ tab: "impostos", ano: "2025", senhorio: "s1" }) }));
    const ano = nos.find((n) => n.type === tipo("impostos/ano"));
    assert.deepEqual(await ano.props.params, { ano: "2025" });
    assert.deepEqual(await ano.props.searchParams, { senhorio: "s1" });
    assert(!nos.some((n) => n.type === tipo("rentabilidade/despesas")));
  }
}

async function redirecionamentos() {
  const { prepareDestination } = require("next/dist/shared/lib/router/utils/prepare-destination");
  const config = carregar("next.config.ts").default;
  const regra = (await config.redirects()).find((r) => r.source === "/impostos");
  assert.equal(regra.destination, "/financas?tab=impostos");
  const destino = prepareDestination({ destination: regra.destination, appendParamsToQuery: true,
    params: {}, query: { ano: "2025", senhorio: "s1" } });
  assert.deepEqual({ ...destino.parsedDestination.query }, { ano: "2025", senhorio: "s1", tab: "impostos" });
  const pagina = carregar("src/app/(app)/impostos/page.tsx", {
    "next/navigation": { redirect: (url) => { throw new Error(url); } },
  }).default;
  await assert.rejects(() => pagina({ searchParams: Promise.resolve({ ano: "2025", senhorio: "s1" }) }),
    /\/financas\?tab=impostos&ano=2025&senhorio=s1/);
}

async function verificarCalendarioVisivel() {
  const { renderToStaticMarkup } = require("react-dom/server");
  const pagina = carregar("src/components/financas/calendario.tsx", {
    "@/lib/portfolio": { getSnapshotComRaw: async () => ({ raw: { insightState: [] } }) },
    "@/lib/portfolio/financas-load": { carregarCalendario: async () => ({ hoje: "2026-11-13", prazos: [
      { id: "imi", dia: "2026-11-30", titulo: "IMI de ensaio", valor: 100, feito: false },
    ] }) },
    "./estado-prazo": { default: () => null },
  }).default;
  const html = renderToStaticMarkup(await pagina({ isAdmin: false }));
  assert.match(html, /30 nov/);
  assert.doesNotMatch(html, /30\/11\/2026|Sem prazos neste mês|dez 2026/);
}

async function verificarPoupanca() {
  const { renderToStaticMarkup } = require("react-dom/server");
  const linha = (contratoId, falta, eurosPorAno = 0) => ({ contratoId, propertyId: contratoId,
    senhorio: "Pessoa de ensaio", taxaAtual: 0.28, taxaPossivel: 0.28, falta, eurosPorAno });
  const dados = { ano: 2026, resumo: { realizavel: 100, porConfirmar: 0 }, despesas: [], porSenhorio: [],
    propriedades: ["sem1", "sem2", "curto", "ganho", "aplicada"].map((id) => ({ id, name: id })), linhas: [
      linha("sem1", "registar o prazo do contrato"), linha("sem2", "registar o prazo do contrato"),
      { ...linha("sem1", "registar o prazo do contrato"), senhorio: "Outro titular" },
      linha("curto", "prazo inferior a 5 anos"), linha("ganho", null, 100), linha("aplicada", null),
    ] };
  const pagina = carregar("src/components/financas/poupanca.tsx", {
    "next/link": { default: ({ children, ...props }) => require("react").createElement("a", props, children) },
    "@/lib/portfolio/financas-load": { carregarPoupanca: async () => dados },
  }).default;
  const html = renderToStaticMarkup(await pagina());
  assert.match(html, /2 contratos sem prazo registado/);
  assert.match(html, /sem prazo não há taxa reduzida/);
  assert.match(html, /href="\/contratos"/);
  assert.match(html, /ganho/);
  assert.match(html, /aplicada/);
  assert.doesNotMatch(html, /registar o prazo do contrato|prazo inferior a 5 anos|>sem1<|>sem2<|>curto</);
  dados.linhas = [linha("curto", "prazo inferior a 5 anos")];
  const vazio = renderToStaticMarkup(await pagina());
  assert.match(vazio, /vazio/);
  assert.match(vazio, /Sem poupança por realizar/);
}

function verificarTipografia() {
  const pastas = ["rentabilidade", "impostos", "controlo", "fracao"];
  const ficheiros = pastas.flatMap((p) => fs.readdirSync(path.join(raiz, "src/components", p))
    .filter((f) => f.endsWith(".tsx")).map((f) => `src/components/${p}/${f}`));
  ficheiros.push("src/components/financas/resultado.tsx", "src/components/financas/resultado-listas.tsx");
  for (const f of ficheiros) assert.doesNotMatch(fs.readFileSync(path.join(raiz, f), "utf8"),
    /text-\[(?:[0-9]|1[01])px\]|text-(?:2xs|3xs)|text-\[0\.[0-6][0-9]*rem\]/, f);
}

(async () => {
  verificarTipografia();
  calendario();
  controlo();
  await autorizacao();
  await separadores();
  await redirecionamentos();
  await verificarCalendarioVisivel();
  await verificarPoupanca();
  console.log("OK t53: calendário, estados, contexto, autorização, migração, separadores e redirects (dados sintéticos).");
})().catch((erro) => { console.error(erro); process.exitCode = 1; });
