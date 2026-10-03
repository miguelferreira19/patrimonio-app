// Self-check de ics.ts. Corre com `npm run check`.
import assert from "node:assert/strict";
import { criarIcs, dobrar, escaparTexto } from "./ics";

// A. Escape de texto (RFC 5545 §3.3.11).
assert.equal(escaparTexto("a; b, c\\d\ne"), "a\\; b\\, c\\\\d\\ne");

// B. Dobragem a 75 OCTETOS, sem partir um carácter acentuado ao meio.
{
  const longa = "DESCRIPTION:" + "ação ".repeat(40);
  const dobrada = dobrar(longa);
  const enc = new TextEncoder();
  for (const l of dobrada.split("\r\n")) assert.ok(enc.encode(l).length <= 75, `linha com ${enc.encode(l).length} octetos`);
  // Desdobrar (tirar CRLF + espaço) devolve exatamente o original.
  assert.equal(dobrada.replace(/\r\n /g, ""), longa);
  assert.equal(dobrar("curta"), "curta");
}

// C. Um evento de dia inteiro, com fim no dia seguinte e alarme 3 dias antes.
{
  const ics = criarIcs(
    [
      {
        data: "2026-12-31",
        id: "x-1",
        tipo: "fiscal",
        titulo: "IMI, 3.ª prestação",
        detalhe: "Regra; ver nota",
        euros: null,
        confianca: "assumido",
        href: "/ano/2026",
      },
    ],
    new Date("2026-10-03T10:20:30.123Z"),
    "https://exemplo.pt",
  );
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(ics), "todas as quebras são CRLF");
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20261231"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20270101"), "o fim do ano vira o ano");
  assert.ok(ics.includes("DTSTAMP:20261003T102030Z"));
  assert.ok(ics.includes("UID:x-1@patrimonio-app"));
  assert.ok(ics.includes("SUMMARY:IMI\\, 3.ª prestação"));
  assert.ok(ics.replace(/\r\n /g, "").includes("https://exemplo.pt/ano/2026"));
  assert.ok(ics.includes("TRIGGER:-P2DT15H"), "alarme às 9h de três dias antes, não à meia-noite");
}

console.log("ics.check.ts: OK (A, B, C)");
