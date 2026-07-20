// Leitura de ficheiros CSV/XLSX no browser -> linhas como objetos {header: valor}.
// Usa imports dinâmicos para não pesar o bundle inicial.

export interface ParsedSheet {
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsv(file);
  }
  return parseXlsx(file);
}

// Alguns exports (ex.: Portal das Finanças) começam por uma linha literal "sep=;" —
// uma dica do Excel para o delimitador, que não é CSV válido. Deteta e remove-a.
const SEP_LINE_RE = /^sep=(.)\r?\n/i;

async function parseCsv(file: File): Promise<ParsedSheet> {
  const Papa = (await import("papaparse")).default;
  const head = await file.slice(0, 16).text();
  const sepMatch = head.match(SEP_LINE_RE);
  const delimiter = sepMatch ? sepMatch[1] : undefined;
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      delimiter,
      transformHeader: (h: string) => h.trim(),
      beforeFirstChunk: sepMatch ? (chunk: string) => chunk.replace(SEP_LINE_RE, "") : undefined,
      complete: (res) => {
        const headers = (res.meta.fields ?? []).filter(Boolean) as string[];
        resolve({ headers, rows: res.data });
      },
      error: (err) => reject(err),
    });
  });
}

async function parseXlsx(file: File): Promise<ParsedSheet> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };

  // matriz crua para detetar a linha de cabeçalho (alguns exports têm linhas de título antes)
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  let headerRowIdx = 0;
  let best = -1;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const filled = matrix[i].filter((c) => String(c).trim() !== "").length;
    if (filled > best) {
      best = filled;
      headerRowIdx = i;
    }
  }
  const headers = matrix[headerRowIdx].map((h, i) => {
    const s = String(h).trim();
    return s || `Coluna ${i + 1}`;
  });
  const rows: Array<Record<string, unknown>> = [];
  for (let i = headerRowIdx + 1; i < matrix.length; i++) {
    const arr = matrix[i];
    if (arr.every((c) => String(c).trim() === "")) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      obj[h] = arr[j] ?? "";
    });
    rows.push(obj);
  }
  return { headers, rows };
}
