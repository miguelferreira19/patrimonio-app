const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function encontrar(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? encontrar(p) : e.name.endsWith(".check.cjs") ? [p] : [];
  }).sort();
}

function executar(dir) {
  const checks = encontrar(dir);
  if (!checks.length) throw new Error("Nenhum check de componentes encontrado.");
  let falhas = 0;
  for (const ficheiro of checks) {
    // Cada check instala mocks próprios no loader de módulos.
    const resultado = spawnSync(process.execPath, [ficheiro], { stdio: "inherit" });
    if (resultado.error) throw resultado.error;
    if (resultado.status !== 0) falhas++;
  }
  console.log(`\n${checks.length - falhas}/${checks.length} checks de componentes OK.`);
  if (falhas) throw new Error(`${falhas} checks de componentes falharam.`);
  return checks.length;
}

executar(path.join(__dirname, "../src/components"));
