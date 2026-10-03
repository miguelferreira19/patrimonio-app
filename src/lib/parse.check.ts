// Self-check de parse.ts. Correr com `npm run check:parse`.
import assert from "node:assert/strict";
import { guessHeader, parseAmount } from "./parse";

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

// parseAmount em PT-PT (2026-10-03). "1.200" escrito num formulário é MIL E DUZENTOS euros,
// e era lido como 1,2: uma renda gravada mil vezes abaixo, sem erro nenhum.
assert.equal(parseAmount("1.200"), 1200);
assert.equal(parseAmount("12.345.678"), 12345678);
assert.equal(parseAmount("1.234,56"), 1234.56);
assert.equal(parseAmount("1 234,56 €"), 1234.56);
assert.equal(parseAmount("850"), 850);
assert.equal(parseAmount("850,5"), 850.5);
assert.equal(parseAmount("1.5"), 1.5); // um ponto com 1 ou 2 casas continua decimal
assert.equal(parseAmount("1.0216"), 1.0216); // coeficiente de atualização: 4 casas, decimal
assert.equal(parseAmount("-1.200,00"), -1200);
assert.equal(parseAmount("50%"), 50);
assert.equal(parseAmount("abc"), null);
assert.equal(parseAmount(""), null);

console.log("parse.check.ts: OK");
