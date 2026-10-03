// Corre TODOS os self-checks já compilados por `tsc -p tsconfig.check.json`.
//
// Porque existe (2026-10-03): o `npm run check` eram 18 compilações `tsc` em série, cada
// uma a recompilar os mesmos módulos, e demorava 73 s. Um gate lento é um gate que se
// salta. Agora é uma compilação e um processo. Um check novo só tem de se chamar
// `*.check.ts` dentro de src/lib: é encontrado sozinho.
//
// Cada check é um módulo que faz `assert` ao carregar e imprime a sua linha de OK; o
// primeiro que falha lança, e o processo sai com erro.
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..", ".check");
const encontrar = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return encontrar(p);
    return e.name.endsWith(".check.js") ? [p] : [];
  });

const checks = encontrar(raiz).sort();
if (checks.length === 0) throw new Error("Nenhum check compilado em .check/");
for (const f of checks) require(f);
console.log(`\n${checks.length} checks OK.`);
