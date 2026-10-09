// Self-check de predios.ts. Corre com `npm run check`.
// Os CÓDIGOS de andar são os formatos reais da carteira; as moradas são inventadas.
import assert from "node:assert/strict";
import { agruparPredios, andarPorExtenso, chaveDoPredio, nomeDaFracao, normalizarMorada, rotuloDaFracao, semGritar } from "./predios";

// A. Códigos de andar, em todos os formatos que a carteira tem.
const casos: Array<[string, string | null]> = [
  ["1ESQ", "1.º Esq."], ["1ºDIR", "1.º Dto."], ["5ºDIREITO", "5.º Dto."], ["5ESQ K", "5.º Esq. (K)"],
  ["RCESQ", "R/c Esq."], ["Rc Direito", "R/c Dto."], ["1 Posterior", "1.º Post."], ["1º Frente", "1.º Frente"],
  ["1POSDIR", "1.º Post. Dto."], ["2PESQ", "2.º Post. Esq."], ["R/CPDT", "R/c Post. Dto."], ["rcpesq", "R/c Post. Esq."],
  ["1ºFDT", "1.º Frente Dto."], ["1FESQ", "1.º Frente Esq."], ["2ºPDt", "2.º Post. Dto."], ["RCFES", "R/c Frente Esq."],
  ["1PES", "1.º Post. Esq."],
  // Não são andares: ficam com o nome que têm.
  ["Repeses 2", null], ["Satão 2", null], ["2", null], ["Casa", null], ["CV", null], ["Tevisil", null],
];
for (const [cru, esperado] of casos) assert.equal(andarPorExtenso(cru), esperado, cru);

// B. Moradas do Portal: sem "Nº:", sem gritar; texto da família não se toca.
assert.equal(normalizarMorada("RUA DAS FLORES Nº: 68"), "Rua das Flores, 68");
assert.equal(normalizarMorada("Av. Almir. Silva Lote: C2"), "Av. Almir. Silva, lote C2");
assert.equal(normalizarMorada("Bairro Novo - 3º Bloco Esquerdo Nº: 3"), "Bairro Novo - 3º Bloco Esquerdo, 3");
assert.equal(normalizarMorada("Rua paulo Lima Nº: 101"), "Rua paulo Lima, 101");
assert.equal(normalizarMorada("  "), null);
assert.equal(semGritar("A SUPER 2000 - MAQUINAS DE BEBIDAS S A"), "A Super 2000 - Maquinas de Bebidas S A");
assert.equal(semGritar("Quinta do galo 3"), "Quinta do galo 3");

// C. Chave do prédio pelo artigo.
assert.deepEqual(chaveDoPredio("182341-U-5077-C", "x"), { chave: "182341-U-5077", tipo: "urbano" });
assert.deepEqual(chaveDoPredio("182341-U-4260-1ºFDT", "x"), { chave: "182341-U-4260", tipo: "urbano" });
assert.deepEqual(chaveDoPredio("182341-U-2306", "x"), { chave: "182341-U-2306", tipo: "urbano" });
assert.deepEqual(chaveDoPredio("182341-R-749", "x"), { chave: "terrenos:182341", tipo: "terrenos" });
assert.deepEqual(chaveDoPredio(null, "x"), { chave: "fracao:x", tipo: "sem_artigo" });

// D. Rótulo de frações sem nome próprio (nome = artigo).
const p = (o: Partial<{ id: string; name: string; matriz_article: string | null; address: string | null; typology: string | null; parish: string | null }>) => ({
  id: "i", name: "", matriz_article: null, address: null, typology: null, parish: null, ...o,
});
assert.equal(rotuloDaFracao(p({ name: "182341-U-4260-CV", matriz_article: "182341-U-4260-CV", typology: "garagem" })), "Garagem CV");
assert.equal(rotuloDaFracao(p({ name: "182341-U-3500-B", matriz_article: "182341-U-3500-B" })), "Fração B");
assert.equal(rotuloDaFracao(p({ name: "182341-U-4260-2ºFDT", matriz_article: "182341-U-4260-2ºFDT" })), "2.º Frente Dto.");
assert.equal(rotuloDaFracao(p({ name: "182341-R-749", matriz_article: "182341-R-749" })), "Terreno 749");
assert.equal(rotuloDaFracao(p({ name: "CASA TONECA", matriz_article: "182341-U-2306" })), "Casa Toneca");

// E. Agrupar: prédio com várias frações, casa isolada com nome, terrenos, sem artigo.
{
  const f = (id: string, name: string, matriz: string | null, address: string | null = null, parish: string | null = null) =>
    ({ property: p({ id, name, matriz_article: matriz, address, parish }) });
  const predios = agruparPredios([
    f("1", "1ESQ", "182341-U-5077-D", "RUA DAS FLORES Nº: 68"),
    f("2", "Rc Direito", "182341-U-5077-A", "RUA DAS FLORES Nº: 68"),
    f("3", "1º Frente", "182341-U-5077-E", "Rua das Flores Nº: 68"),
    f("4", "CASA TONECA", "182341-U-2306", "Rua do Sol Nº: 23"),
    f("5", "182341-R-749", "182341-R-749", null, "Freguesia X"),
    f("6", "182341-R-1058", "182341-R-1058"),
    f("7", "Loja nova", null),
  ]);
  const porNome = Object.fromEntries(predios.map((x) => [x.nome, x]));
  const flores = porNome["Rua das Flores, 68"];
  assert.ok(flores, "a morada mais frequente dá o nome ao prédio");
  assert.deepEqual(flores.fracoes.map((x) => x.rotulo), ["1.º Esq.", "1.º Frente", "R/c Dto."]);
  assert.equal(porNome["Casa Toneca"].morada, "Rua do Sol, 23", "casa isolada: nome próprio, morada à parte");
  assert.equal(porNome["Terrenos · Freguesia X"].fracoes.length, 2, "rústicos da mesma freguesia juntos");
  assert.equal(porNome["Loja nova"].tipo, "sem_artigo");
  assert.equal(predios.length, 4);
}

// F. Fora do prédio: andar com morada; nome próprio sozinho.
assert.equal(nomeDaFracao(p({ name: "1ESQ", matriz_article: "1-U-2-D", address: "RUA DAS FLORES Nº: 68" })), "Rua das Flores, 68 · 1.º Esq.");
assert.equal(nomeDaFracao(p({ name: "Tevisil", matriz_article: "1-U-3-U", address: "Rua X Nº: 1" })), "Tevisil");
assert.equal(nomeDaFracao(p({ name: "1-U-3-B", matriz_article: "1-U-3-B", address: null })), "Fração B");

console.log("predios.check.ts: OK (A, B, C, D, E, F)");
