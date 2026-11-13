import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function extrairTokens(bloco: string): Record<string, string> {
  return Object.fromEntries(
    [...bloco.matchAll(/--s-([a-z0-9-]+)\s*:\s*([^;]+);/gi)]
      .map(([, nome, valor]) => [nome, valor.trim()]),
  );
}

function luminancia(cor: string): number {
  assert.match(cor, /^#[0-9a-f]{6}$/i, `Cor hexadecimal inválida: ${cor}`);
  const canais = [1, 3, 5].map((posicao) => {
    const canal = parseInt(cor.slice(posicao, posicao + 2), 16) / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return canais[0] * 0.2126 + canais[1] * 0.7152 + canais[2] * 0.0722;
}

function contraste(texto: string, fundo: string): number {
  const a = luminancia(texto);
  const b = luminancia(fundo);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

assert.equal(contraste("#000000", "#ffffff"), 21);
assert.equal(contraste("#14161a", "#14161a"), 1);
assert.ok(Math.abs(contraste("#777777", "#ffffff") - 4.478) < 0.001);
assert.throws(() => luminancia("invalid"));
assert.deepEqual(extrairTokens("--s-tinta: #14161a; --s-carta: #f3f4f6;"), {
  tinta: "#14161a", carta: "#f3f4f6",
});

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const claro = css.match(/:root\s*\{([^}]+)\}/);
const escuro = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]+)\}/);
assert.ok(claro, "Falta o bloco :root do tema claro.");
assert.ok(escuro, "Falta o bloco :root do tema escuro.");

const pares: Array<[string, string]> = [
  ...["tinta", "tinta-2", "tinta-3"].flatMap((texto): Array<[string, string]> =>
    [[texto, "papel"], [texto, "carta"]]),
  ["perda", "papel"], ["perda", "carta"], ["perda", "perda-tenue"],
  ["perda-forte", "perda-tenue"], ["futuro", "papel"], ["futuro", "futuro-tenue"],
  ["papel", "perda"], ["carta", "acao"],
];
const falhas: string[] = [];
let menor = Infinity;
for (const [tema, bloco] of [["claro", claro[1]], ["escuro", escuro[1]]]) {
  const tokens = extrairTokens(bloco);
  for (const [texto, fundo] of pares) {
    assert.ok(tokens[texto], `Falta --s-${texto} no tema ${tema}.`);
    assert.ok(tokens[fundo], `Falta --s-${fundo} no tema ${tema}.`);
    const razao = contraste(tokens[texto], tokens[fundo]);
    menor = Math.min(menor, razao);
    if (razao < 4.5) falhas.push(`${tema}: ${texto}/${fundo} = ${razao.toFixed(3)}:1 (faltam ${(4.5 - razao).toFixed(3)})`);
  }
}
assert.equal(falhas.length, 0, `Contraste abaixo de 4,5:1:\n${falhas.join("\n")}`);
console.log(`OK: contraste WCAG, ${pares.length * 2} pares nos dois temas (mínimo ${menor.toFixed(3)}:1).`);
