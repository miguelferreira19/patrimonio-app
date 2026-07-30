// Self-check do escritor de .docx. Correr com `npm run check:docx`.
// Um ZIP mal escrito não "fica feio": o Word recusa o ficheiro inteiro e a mensagem que
// aparece não diz porquê. Estes casos apanham as três formas de o partir.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { criarDocx, crc32, nomeDeFicheiro } from "./docx";

// A) CRC32 contra o vetor canónico da norma. É o número que o Word usa para decidir se a
//    entrada está corrompida; se este falhar, nada do resto interessa.
{
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  assert.equal(crc32(Buffer.from("")), 0);
}

// B) Estrutura do ZIP: assinatura no início, fim de diretório central no fim, e as TRÊS
//    entradas que fazem um .docx mínimo declaradas no diretório.
{
  const buf = criarDocx([{ texto: "Olá" }]);
  assert.equal(buf.readUInt32LE(0), 0x04034b50, "tem de comecar com um cabecalho local");

  const fim = buf.length - 22;
  assert.equal(buf.readUInt32LE(fim), 0x06054b50, "fim do diretorio central no sitio certo");
  assert.equal(buf.readUInt16LE(fim + 10), 3, "tres entradas: content-types, rels, document");

  // O offset e o tamanho do diretório central têm de fechar com o ficheiro real: é aqui
  // que um erro de contagem de bytes se manifesta.
  const tamanhoCentral = buf.readUInt32LE(fim + 12);
  const offsetCentral = buf.readUInt32LE(fim + 16);
  assert.equal(offsetCentral + tamanhoCentral, fim, "o diretorio central tem de encostar ao fim");
  assert.equal(buf.readUInt32LE(offsetCentral), 0x02014b50);

  for (const nome of ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]) {
    assert.ok(buf.includes(Buffer.from(nome)), `falta a entrada ${nome}`);
  }
}

// C) O texto vai lá dentro escapado. Um "&" cru num nome de inquilino
//    ("MIGUEL FERREIRA & SOUSA GOMES LDA", que existe mesmo na carteira) torna o XML
//    inválido e o Word recusa o documento todo.
{
  const buf = criarDocx([{ texto: "MIGUEL FERREIRA & SOUSA GOMES <LDA>", negrito: true }]);
  const texto = buf.toString("utf8");
  assert.ok(texto.includes("MIGUEL FERREIRA &amp; SOUSA GOMES &lt;LDA&gt;"), "tem de escapar");
  assert.ok(!/[^&]&[^a-z]/.test(texto.split("<w:t")[1] ?? ""), "nenhum & cru no corpo");
  assert.ok(texto.includes("<w:b/>"), "negrito pedido tem de aparecer");
}

// D) Determinismo: o mesmo conteúdo dá o mesmo ficheiro (datas fixas). Sem isto, este
//    próprio check seria instável.
{
  assert.ok(criarDocx([{ texto: "x" }]).equals(criarDocx([{ texto: "x" }])));
}

// E) Nome do ficheiro: sem acentos nem espaços, que partem o Content-Disposition.
{
  assert.equal(nomeDeFicheiro(["Cessão", "Sátão 2"]), "Cessao-Satao-2.docx");
  assert.equal(nomeDeFicheiro([null, undefined, ""]), "documento.docx");
}

console.log("docx: casos OK (A, B, C, D, E)");
