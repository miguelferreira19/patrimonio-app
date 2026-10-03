// Calendário .ics (RFC 5545) a partir da agenda (2026-10-03). Módulo PURO.
//
// Escrito à mão pela mesma razão do `docx.ts`: são três regras de formato (linhas CRLF,
// escape de texto, dobrar linhas a 75 octetos) e uma dependência para isto pesava mais do
// que elas. Um ficheiro destes abre-se no iPhone, no Google Calendar e no Outlook.
//
// Eventos de DIA INTEIRO (`VALUE=DATE`): um prazo fiscal não tem hora, e com hora o
// calendário de cada um mudava-a de fuso. Cada evento leva um alarme três dias antes, às 9h
// (`-P2DT15H` a contar da meia-noite do dia do prazo): `-P3D` tocava à meia-noite.

import type { Prazo } from "./portfolio/agenda";

/** Texto de propriedade: `\`, `;`, `,` e mudanças de linha escapam-se (RFC 5545 §3.3.11). */
export function escaparTexto(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Linhas com mais de 75 OCTETOS dobram-se: CRLF e um espaço (§3.1). Mede-se em bytes
 *  UTF-8 e nunca se parte um carácter ao meio, senão os acentos chegavam estragados. */
export function dobrar(linha: string): string {
  const enc = new TextEncoder();
  const partes: string[] = [];
  let atual = "";
  let bytes = 0;
  for (const ch of linha) {
    const n = enc.encode(ch).length;
    const limite = partes.length === 0 ? 75 : 74; // as continuações começam com um espaço
    if (bytes + n > limite) {
      partes.push(atual);
      atual = "";
      bytes = 0;
    }
    atual += ch;
    bytes += n;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

const dataIcs = (iso: string) => iso.replace(/-/g, "");

function diaSeguinte(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** O ficheiro inteiro. `agora` vem de fora para o resultado ser testável. `url` é a base
 *  da app, para cada evento levar o link para a página que o resolve. */
export function criarIcs(prazos: Prazo[], agora: Date, url: string): string {
  const stamp = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//patrimonio-app//agenda//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Património · prazos",
  ];
  for (const p of prazos) {
    const descricao = p.href ? `${p.detalhe}\n\n${url}${p.href}` : p.detalhe;
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${p.id}@patrimonio-app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dataIcs(p.data)}`,
      `DTEND;VALUE=DATE:${dataIcs(diaSeguinte(p.data))}`,
      `SUMMARY:${escaparTexto(p.titulo)}`,
      `DESCRIPTION:${escaparTexto(descricao)}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escaparTexto(p.titulo)}`,
      "TRIGGER:-P2DT15H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR");
  return linhas.map(dobrar).join("\r\n") + "\r\n";
}
