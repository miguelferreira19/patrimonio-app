// Escrever um .docx à mão. Módulo PURO (sem I/O, sem rede).
//
// Porquê e não uma biblioteca: um .docx é um ZIP com três ficheiros XML lá dentro, e um
// ZIP sem compressão ("stored") são cabeçalhos de bytes fixos mais um CRC32. Dá isto, ~90
// linhas, contra ~500 kB de dependência nova para escrever quatro parágrafos. A regra do
// projeto é não acrescentar dependências para o que umas linhas resolvem.
//
// Porquê não o truque do HTML com extensão .doc: o Word abre, mas mostra o aviso "o
// formato do ficheiro não corresponde à extensão" antes de abrir. Numa app que a família
// usa, esse aviso é um bug com outro nome. Isto é um .docx a sério.
//
// O que NÃO faz: imagens, tabelas, cabeçalhos, estilos nomeados. Uma carta são parágrafos
// com negrito, e é isso que está aqui.

import { Buffer } from "node:buffer";

export interface DocxParagrafo {
  texto: string;
  negrito?: boolean;
  /** Espaço depois do parágrafo, em vigésimos de ponto. 160 = uma linha em branco curta. */
  espacoDepois?: number;
}

// ---------- CRC32 (o ZIP exige-o por entrada) ----------
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------- ZIP (só entradas "stored", método 0) ----------
// Data fixa 1980-01-01 de propósito: o mesmo conteúdo dá sempre o mesmo ficheiro, o que
// torna o self-check possível. O Word ignora a data.
const HORA_DOS = 0;
const DATA_DOS = 0x0021;

function zip(entradas: Array<{ nome: string; dados: Buffer }>): Buffer {
  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const { nome, dados } of entradas) {
    const nomeBuf = Buffer.from(nome, "utf8");
    const crc = crc32(dados);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // assinatura
    local.writeUInt16LE(20, 4); // versão necessária
    local.writeUInt16LE(0x0800, 6); // flag: nomes em UTF-8
    local.writeUInt16LE(0, 8); // método: stored
    local.writeUInt16LE(HORA_DOS, 10);
    local.writeUInt16LE(DATA_DOS, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    local.writeUInt16LE(0, 28); // sem campo extra
    locais.push(local, nomeBuf, dados);

    const cab = Buffer.alloc(46);
    cab.writeUInt32LE(0x02014b50, 0);
    cab.writeUInt16LE(20, 4); // versão de quem escreveu
    cab.writeUInt16LE(20, 6);
    cab.writeUInt16LE(0x0800, 8);
    cab.writeUInt16LE(0, 10);
    cab.writeUInt16LE(HORA_DOS, 12);
    cab.writeUInt16LE(DATA_DOS, 14);
    cab.writeUInt32LE(crc, 16);
    cab.writeUInt32LE(dados.length, 20);
    cab.writeUInt32LE(dados.length, 24);
    cab.writeUInt16LE(nomeBuf.length, 28);
    cab.writeUInt32LE(0, 30); // extra + comentário
    cab.writeUInt16LE(0, 34); // nº do disco
    cab.writeUInt32LE(0, 36); // atributos
    cab.writeUInt32LE(offset, 42);
    central.push(cab, nomeBuf);

    offset += local.length + nomeBuf.length + dados.length;
  }

  const centralBuf = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(centralBuf.length, 12);
  fim.writeUInt32LE(offset, 16);

  return Buffer.concat([...locais, centralBuf, fim]);
}

// ---------- OOXML ----------
function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Caracteres de controlo são inválidos em XML e o Word recusa o ficheiro inteiro.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

/** A4 em twips (1/1440 de polegada), com margens de 2,5 cm. */
const SECCAO =
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709"/></w:sectPr>';

export function criarDocx(paragrafos: DocxParagrafo[]): Buffer {
  const corpo = paragrafos
    .map((p) => {
      const espaco = `<w:pPr><w:spacing w:after="${p.espacoDepois ?? 160}"/><w:jc w:val="both"/></w:pPr>`;
      const rPr = p.negrito ? "<w:rPr><w:b/></w:rPr>" : "";
      // xml:space="preserve" é obrigatório: sem isto o Word come os espaços das linhas
      // de preenchimento ("____ , ____") e a minuta sai colada.
      return `<w:p>${espaco}<w:r>${rPr}<w:t xml:space="preserve">${escapar(p.texto)}</w:t></w:r></w:p>`;
    })
    .join("");

  const documento =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${corpo}${SECCAO}</w:body></w:document>`;

  return zip([
    { nome: "[Content_Types].xml", dados: Buffer.from(CONTENT_TYPES, "utf8") },
    { nome: "_rels/.rels", dados: Buffer.from(RELS, "utf8") },
    { nome: "word/document.xml", dados: Buffer.from(documento, "utf8") },
  ]);
}

/** Nome de ficheiro para o cabeçalho Content-Disposition: sem acentos nem pontuação que
 *  parta o header em navegadores antigos. */
export function nomeDeFicheiro(partes: Array<string | null | undefined>): string {
  const base = partes
    .filter(Boolean)
    .join("-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "documento"}.docx`;
}
