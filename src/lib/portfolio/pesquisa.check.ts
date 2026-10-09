// Self-check de pesquisa.ts. Corre com `npm run check`. Dados inventados.
import assert from "node:assert/strict";
import { construirIndice, normalizar, procurar } from "./pesquisa";

assert.equal(normalizar("  Rua das CAMÉLIAS, 1.º Esq. "), "rua das camelias, 1 esq");

const f = (id: string, name: string, matriz: string, tenant: string | null, nif: string | null = null) => ({
  property: { id, name, matriz_article: matriz, address: "RUA DAS CAMÉLIAS Nº: 88", parish: null, municipality: null, typology: null },
  activeContract: tenant ? { tenant_name: tenant, tenant_nif: nif } : null,
});
const indice = construirIndice({
  ativos: [
    f("a", "1ESQ", "182341-U-10-A", "MARTA OLIVEIRA", "123456789"),
    f("b", "RCDIR", "182341-U-10-B", "JOÃO SÁ"),
    f("c", "Tevisil", "182341-U-20", null),
  ],
  docs: [{ escopo: "182341-U-10-A", nome: "contrato.pdf", url: "https://x/assinado" }, { escopo: "geral", nome: "IRS_2025.pdf", url: null }],
  isAdmin: false,
});

// A. Sem acentos, em qualquer ordem, e o prédio aparece antes das frações dele.
const camelias = procurar(indice, "camelias");
assert.equal(camelias[0].tipo, "predio");
assert.equal(camelias[0].titulo, "Rua das Camélias, 88");
// A fração primeiro; o documento arquivado nela também casa, e vem depois.
assert.deepEqual(procurar(indice, "esq camélias").map((r) => r.tipo), ["fracao", "documento"]);
assert.equal(procurar(indice, "esq camélias")[0].titulo, "Rua das Camélias, 88 · 1.º Esq.");

// B. Inquilino por nome ou por NIF; o viewer vai para a fração, não para a ficha de admin.
const marta = procurar(indice, "marta");
assert.equal(marta[0].tipo, "inquilino");
assert.equal(marta[0].titulo, "Marta Oliveira");
assert.equal(marta[0].href, "/fracoes/a");
assert.equal(procurar(indice, "123456")[0].titulo, "Marta Oliveira");

// C. Documentos com a fração onde estão; sem link assinado não entram.
const doc = procurar(indice, "contrato");
assert.equal(doc[0].sub, "Rua das Camélias, 88 · 1.º Esq.");
assert.equal(procurar(indice, "irs").length, 0);

// E. Termos no início das palavras: "camelias 1" é o 1.º andar, não "o que tem um 1 algures".
assert.deepEqual(
  procurar(indice, "camelias 1").filter((r) => r.tipo === "fracao").map((r) => r.titulo),
  ["Rua das Camélias, 88 · 1.º Esq."],
);

// D. Nada para procurar, nada devolvido; o limite corta.
assert.equal(procurar(indice, "   ").length, 0);
assert.equal(procurar(indice, "rua", 2).length, 2);

console.log("pesquisa.check.ts: OK (A, B, C, D, E)");
