// Parsing tolerante de valores vindos de ficheiros (Portal das Finanças, INE, extratos).

/** "1.234,56 €" | "1234.56" | " 700 " -> número (ou null) */
export function parseAmount(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/[€\s ]/g, "");
  // formato PT: 1.234,56 → remove separador de milhares e troca vírgula
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Números de série de datas do Excel (dias desde 1899-12-30). */
function excelSerialToISO(n: number): string | null {
  if (n < 20000 || n > 60000) return null; // fora de ~1954..2064 → não é data
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Datas em vários formatos -> ISO YYYY-MM-DD (ou null).
 * Aceita: 2025-01-15, 15/01/2025, 15-01-2025, 2025/01/15, 01/2025, 2025-01, jan/2025 não.
 */
export function parseDateISO(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return excelSerialToISO(v);
  const s = String(v).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  m = s.match(/^(\d{1,2})[-/](\d{4})$/); // MM/YYYY
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;

  m = s.match(/^(\d{4})[-/](\d{1,2})$/); // YYYY-MM
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-01`;

  const n = Number(s);
  if (Number.isFinite(n)) return excelSerialToISO(n);
  return null;
}

/** Data ISO -> 1º dia do mês (chave de mês). */
export function toMonthKey(iso: string | null): string | null {
  if (!iso || !/^\d{4}-\d{2}/.test(iso)) return null;
  return `${iso.slice(0, 7)}-01`;
}

/** Como String.includes, mas trata U+FFFD (�) como um carácter-qualquer: alguns exports do
 *  Portal chegam com a acentuação corrompida (á/é/í/ó/ú/ã/ç/ê → �, sempre 1-para-1, sem
 *  encurtar a palavra) e isso partia o reconhecimento de colunas como "Imóvel"/"Referência". */
function fuzzyIncludes(haystack: string, needle: string): boolean {
  if (needle.length === 0) return true;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      const a = haystack[i + j];
      const b = needle[j];
      if (a !== b && a !== "�" && b !== "�") continue outer;
    }
    return true;
  }
  return false;
}

/** Heurística: escolhe o header que contém alguma das palavras-chave. */
export function guessHeader(headers: string[], keywords: string[]): string {
  const lower = headers.map((h) => h.toLowerCase());
  for (const k of keywords) {
    const i = lower.findIndex((h) => fuzzyIncludes(h, k));
    if (i >= 0) return headers[i];
  }
  return "";
}
