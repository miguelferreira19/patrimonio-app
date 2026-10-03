// Parsing tolerante de valores vindos de ficheiros (Portal das Finanças, INE, extratos).

/** "1.234,56 €" | "1234.56" | " 700 " -> número (ou null) */
export function parseAmount(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/[€%\s ]/g, "");
  // Regras de PT-PT (2026-10-03), por ordem:
  //   1. vírgula E ponto: o ÚLTIMO dos dois é o decimal ("1.234,56", e também "1,234.56"
  //      de uma folha em inglês);
  //   2. só vírgula: é o decimal ("850,5", "3,125" de quota). Várias vírgulas são milhares;
  //   3. só pontos em grupos perfeitos de três ("1.200", "12.345.678"): milhares. Era lido
  //      como 1,2, e uma renda escrita assim ficava gravada mil vezes abaixo;
  //   4. qualquer outro ponto é decimal ("1.5", "1.0216" de um coeficiente).
  // O ambíguo "3.125" lê-se 3125 pela regra 3; é por isso que os formulários pré-preenchem
  // com vírgula (`numeroParaCampo`) e o cartão dos coeficientes tem o seu próprio parse.
  const virgula = s.lastIndexOf(",");
  const ponto = s.lastIndexOf(".");
  if (virgula >= 0 && ponto >= 0) {
    const decimal = virgula > ponto ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    s = s.split(milhar).join("").replace(decimal, ".");
  } else if (virgula >= 0) {
    s = s.indexOf(",") === virgula ? s.replace(",", ".") : s.split(",").join("");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.split(".").join("");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Um número para pré-preencher um campo de formulário, à portuguesa ("3,125", "850,5").
 *  É o inverso exato de `parseAmount`: com `String(v)` uma quota 3.125 voltava a ler-se 3125
 *  ao gravar sem tocar no campo. Sem separador de milhares de propósito, para não haver
 *  ambiguidade nenhuma. */
export function numeroParaCampo(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "" : String(v).replace(".", ",");
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
