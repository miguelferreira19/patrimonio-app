// SSR com dados sintéticos; sem servidor Next, fontes remotas ou sessão real.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const raiz = process.cwd();
const carregar = Module._load;
let sessao = { user: { id: "exemplo" }, isAdmin: false };
Module._load = function (nome, parent, main) {
  if (nome === "next/link") return ({ children, ...props }) => React.createElement("a", props, children);
  if (nome === "next/navigation") return { redirect: (url) => { throw new Error(`redirect:${url}`); } };
  if (nome === "@/lib/data") return { getSession: async () => sessao };
  if (nome.endsWith("/modal")) return { Modal: () => null };
  return carregar.call(this, nome.startsWith("@/") ? path.join(raiz, "src", nome.slice(2)) : nome, parent, main);
};
for (const extensao of [".ts", ".tsx"]) {
  require.extensions[extensao] = (modulo, ficheiro) => {
    const resultado = ts.transpileModule(fs.readFileSync(ficheiro, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: ficheiro,
    });
    modulo._compile(resultado.outputText, ficheiro);
  };
}
const kit = require("./index.ts");
const ui = require("../ui.tsx");
const html = (componente, props) => renderToStaticMarkup(React.createElement(componente, props));

function verificarComposicao() {
  for (const componente of [ui.Input, ui.Select, ui.Textarea]) {
    const campo = React.createElement(componente);
    const cartao = html(ui.Card, { children: campo }).replaceAll("&amp;", "&");
    const tag = componente === ui.Input ? "input" : componente === ui.Select ? "select" : "textarea";
    assert.ok(cartao.includes(`[&_${tag}.bg-carta]:bg-elevado`), `Campo ${tag} distinguível no cartão`);
  }
  for (const componente of [kit.Money, kit.Figure]) {
    const resultado = html(componente, { value: 42, unit: "%", escala: "sm", tom: "perda" });
    assert.match(resultado, /text-\[max\(0.72em,12px\)\]!/);
    assert.match(resultado, /opacity-100!/);
  }
}

function verificarBarra() {
  for (const [parte, total, percentagem] of [[25, 100, 25], [-2, 100, 0], [200, 100, 100], [2, 0, 0], [2, -1, 0], [NaN, 10, 0], [1, Infinity, 0]]) {
    const resultado = html(kit.Barra, { parte, total, tom: "perda" });
    assert.match(resultado, new RegExp(`width:${percentagem}%`));
    assert.match(resultado, new RegExp(`aria-valuenow="${percentagem}"`));
    assert.doesNotMatch(resultado, /NaN|Infinity/);
  }
}

function verificarMeses() {
  const estados = ["pago", "atraso", "por_receber", "sem_info", "fora"];
  const meses = estados.map((estado, i) => ({ chave: `2026-0${i + 1}-01`, estado }));
  const resultado = html(kit.Tira, { meses, tamanho: "m", rotulos: true });
  for (const estado of ["Pago", "Em atraso", "Por receber", "Sem informação", "Sem contrato"]) {
    assert.ok(resultado.includes(estado), estado);
  }
  assert.match(resultado, /jan 2026/);
  assert.equal((resultado.match(/celula-in/g) || []).length, 5);
  assert.match(resultado, /--c:4/);
  assert.match(resultado, /border-dashed/);
  assert.doesNotMatch(resultado, /<button|<a /);
}

function verificarNavegacao() {
  const itens = [{ id: "todos", rotulo: "Todos", n: 0, href: "#todos" }, { id: "atraso", rotulo: "Em atraso", href: "#atraso" }];
  const pilulas = html(kit.Pilulas, { itens, ativo: "todos" });
  assert.equal((pilulas.match(/aria-current="page"/g) || []).length, 1);
  assert.match(pilulas, />0<\/span>/);
  for (const componente of [kit.Bloco, kit.Linha]) {
    const props = { tom: "perda", titulo: "Exemplo", rotulo: "Em atraso", valor: "42", href: "#exemplo", children: "Detalhes" };
    const resultado = html(componente, props);
    assert.match(resultado, /^<a /);
    assert.equal((resultado.match(/<a /g) || []).length, 1);
    assert.ok(resultado.includes("Detalhes"));
    assert.doesNotMatch(html(componente, { ...props, href: undefined }), /<a /);
  }
}

async function verificarCatalogo() {
  const pagina = require("../../app/(app)/admin/catalogo/page.tsx").default;
  await assert.rejects(pagina(), /redirect:\//);
  sessao = { user: null, isAdmin: true };
  await assert.rejects(pagina(), /redirect:\//);
  sessao = { user: { id: "exemplo" }, isAdmin: true };
  const resultado = renderToStaticMarkup(await pagina());
  assert.match(resultado, /Dados fictícios/);
  assert.match(resultado, /max-w-\[390px\]/);
}

async function main() {
  for (const nome of ["Bloco", "Tira", "Pilulas", "Linha", "Barra"]) assert.equal(typeof kit[nome], "function", `${nome} exportado`);
  verificarBarra();
  verificarMeses();
  verificarNavegacao();
  verificarComposicao();
  assert.match(html(ui.Button, { as: "a", href: "#exemplo", children: "Abrir" }), /^<a /);
  assert.match(html(ui.Input, { defaultValue: "Exemplo", disabled: true }), /disabled=""/);
  await verificarCatalogo();
  console.log("OK: primitivas Sinal, limites das barras, meses acessíveis, navegação e guarda do catálogo (SSR sintético).");
}
main().catch((erro) => { console.error(erro); process.exitCode = 1; });
