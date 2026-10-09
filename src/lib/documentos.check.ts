// Self-check do arquivo. Corre com `npm run check`.
// O que está aqui é a convenção de nomes do bucket: se se partir, os documentos deixam de
// aparecer na fração certa (ou pior, um upload rebenta com 400 e ninguém sabe porquê).
import assert from "node:assert/strict";
import { GERAL, caminho, comSufixo, escopoSugerido, nomeSeguro, partirCaminho, tipoDoDocumento } from "./documentos";

// A) Ida e volta: o que se escreve é o que se lê.
{
  const p = caminho("182341-U-5077-A", "Contrato de arrendamento.pdf");
  assert.equal(p, "182341-U-5077-A__Contrato_de_arrendamento.pdf");
  assert.deepEqual(partirCaminho(p), {
    escopo: "182341-U-5077-A",
    nome: "Contrato_de_arrendamento.pdf",
  });
}

// B) Acentos e espaços não podem chegar ao Storage (dão 400 no upload), mas o ficheiro
//    tem de continuar reconhecível.
{
  assert.equal(nomeSeguro("Caderneta Predial — Sátão.pdf"), "Caderneta_Predial_Satao.pdf");
  assert.equal(nomeSeguro("C:\\Users\\migue\\irs 2025.pdf"), "irs_2025.pdf");
  assert.equal(nomeSeguro("   "), "documento", "nome vazio nao pode gerar chave vazia");
}

// C) Sem escopo é `geral`, e um objeto sem separador (carregado pelo Studio) não some.
{
  assert.equal(caminho(null, "IRS.pdf"), `${GERAL}__IRS.pdf`);
  assert.deepEqual(partirCaminho("solto.pdf"), { escopo: GERAL, nome: "solto.pdf" });
}

// D) O separador nunca sobrevive dentro do escopo — se sobrevivesse, `partirCaminho`
//    cortava no sítio errado e o documento aparecia numa fração inventada.
{
  const p = caminho("a__b", "x.pdf");
  assert.deepEqual(partirCaminho(p), { escopo: "a-b", nome: "x.pdf" });
}

// E) Arquivar as cadernetas sem escolher fração a fração: o nome do PDF É o artigo.
{
  const matrizes = ["182341-U-5077-A", "182341-U-3500", "182341-U-3500-A", "182341-U-4260-1ºPES"];
  assert.equal(escopoSugerido("182341-U-5077-A.pdf", matrizes), "182341-U-5077-A");
  assert.equal(
    escopoSugerido("182341-U-3500-A.pdf", matrizes),
    "182341-U-3500-A",
    "entre dois artigos que casam ganha o mais especifico",
  );
  // O `º` do artigo não sobrevive a `nomeSeguro`; a comparação tem de ser indiferente a isso.
  assert.equal(escopoSugerido("182341-U-4260-1ºPES contrato.pdf", matrizes), "182341-U-4260-1ºPES");
  assert.equal(escopoSugerido("IRS_2025.pdf", matrizes), null, "sem palpite devolve null");
  assert.equal(escopoSugerido("x.pdf", [null, ""]), null, "fracao sem artigo nunca casa");
}

// F) Um nome repetido nunca escreve por cima: ganha um sufixo antes da extensão.
{
  assert.equal(comSufixo("182341-U-5077-A__contrato.pdf", 2), "182341-U-5077-A__contrato-2.pdf");
  assert.equal(comSufixo("geral__notas", 3), "geral__notas-3", "sem extensão, o sufixo vai no fim");
  // O ponto do escopo nunca conta como extensão.
  assert.equal(comSufixo("a.b__ficheiro", 2), "a.b__ficheiro-2");
  assert.deepEqual(partirCaminho(comSufixo(caminho("182341-U-1", "x.pdf"), 2)), {
    escopo: "182341-U-1",
    nome: "x-2.pdf",
  });
}

// G) Tipo pelo nome, para os filtros do Arquivo.
{
  assert.equal(tipoDoDocumento("182341-U-5077-A.pdf"), "caderneta");
  assert.equal(tipoDoDocumento("Caderneta_predial.pdf"), "caderneta");
  assert.equal(tipoDoDocumento("contrato-2.pdf"), "contrato");
  assert.equal(tipoDoDocumento("IRS_PAI.pdf"), "irs");
  assert.equal(tipoDoDocumento("Declaração anual.pdf"), "irs");
  assert.equal(tipoDoDocumento("Carta de atualização 2025.docx"), "carta");
  assert.equal(tipoDoDocumento("foto.jpg"), "outro");
}

console.log("documentos: casos OK (A, B, C, D, E, F, G)");
