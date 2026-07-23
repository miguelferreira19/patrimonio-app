// Self-check de parse.ts. Correr com `npm run check:parse`.
import assert from "node:assert/strict";
import { guessHeader } from "./parse";

// Cabeçalho limpo continua a funcionar (comportamento antigo).
assert.equal(guessHeader(["Referência", "Nº de Contrato"], ["referência", "referencia"]), "Referência");

// Acentuação corrompida (U+FFFD) — o caso real que motivou o fix: "Refer�ncia", "Im�vel",
// "Locat�rio" (Portal exporta às vezes assim; sempre 1 carácter por 1 carácter, sem encurtar).
assert.equal(guessHeader(["Refer�ncia"], ["referencia"]), "Refer�ncia");
assert.equal(guessHeader(["Im�vel"], ["imovel"]), "Im�vel");
assert.equal(guessHeader(["Locat�rio"], ["locatario"]), "Locat�rio");
assert.equal(guessHeader(["Data de In�cio"], ["inicio"]), "Data de In�cio");

// Não inventa correspondências: palavra de tamanho diferente não deve "encaixar" à força.
assert.equal(guessHeader(["Estado"], ["renda"]), "");

// Sem nenhuma keyword a bater certo, devolve "".
assert.equal(guessHeader(["Qualquer coisa"], ["renda", "valor"]), "");

console.log("parse.check.ts: OK");
