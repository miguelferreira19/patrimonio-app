const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const original = Module._load;
Module._load = function (nome, parent, main) {
  if (nome === "next/link") return ({ children, ...props }) => React.createElement("a", props, children);
  if (nome === "@/components/cartas") return require("../../lib/portfolio/cartas-diario.ts");
  return original.call(this, nome.startsWith("@/") ? path.join(__dirname, "../../", nome.slice(2)) : nome, parent, main);
};
for (const ext of [".ts", ".tsx"]) require.extensions[ext] = (modulo, ficheiro) => {
  const js = ts.transpileModule(fs.readFileSync(ficheiro, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }, fileName: ficheiro }).outputText;
  modulo._compile(js, ficheiro);
};
const html = (componente, props) => renderToStaticMarkup(React.createElement(componente, props));
require("./dados.check.ts");
const { EscadaInquilino } = require("./escada.tsx");
const { FactosInquilino } = require("./factos.tsx");
const { DiarioInquilino } = require("./diario.tsx");

function escada() {
  const atraso = { contract: { id: "c1" }, property: { name: "Casa de ensaio" },
    meses: 2, desde: "2026-09-01" };
  const resultado = html(EscadaInquilino, { atraso, diario: [], hoje: "2026-11-13" });
  assert.match(resultado, /Lembrete[^:]*: Dispensado/);
  assert.match(resultado, /bg-regua-forte/);
  assert.match(resultado, /Interpelação[^:]*: A enviar/);
  assert.match(resultado, /Aviso de resolução: Por vir/);
  const inicial = html(EscadaInquilino, { atraso: { ...atraso, meses: 1 }, diario: [], hoje: "2026-11-13" });
  assert.match(inicial, /Lembrete[^:]*: A enviar/);
  assert.doesNotMatch(inicial, /Dispensado/);
}

function datas() {
  const factos = html(FactosInquilino, { ficha: { desde: "2015-02-01", contratos: [] },
    atualizacao: null, diaHabitual: 19 });
  assert.match(factos, /fev 2015/);
  assert.doesNotMatch(factos, /01\/02\/2015/);
  const eventos = ["2026-08-28", "2025-12-09"].map((dia) => ({
    id: dia, dia, tipo: "nota", texto: "Ensaio", autor: null,
  }));
  const diario = html(DiarioInquilino, { eventos, hoje: "2026-11-13" });
  assert.match(diario, />28 ago<\/time>/);
  assert.match(diario, />9 dez 2025<\/time>/);
  const futuro = html(DiarioInquilino, { eventos, hoje: "2027-01-01" });
  assert.match(futuro, />28 ago 2026<\/time>/);
}

escada();
datas();
console.log("OK: inquilino, dia inteiro, passos dispensados e datas do contrato e diário (dados sintéticos).");
