// Cliente da API JSON do INE (server-only).
// Indicadores (confirmados a 2026-07-18 no catálogo oficial):
//   0014771 — Valor mediano das rendas de novos contratos de arrendamento (€/m²),
//             últimos 12 meses, trimestral, até à freguesia (NUTS-2024, geografia 2025)
//   0012246 — Valor mediano das vendas de alojamentos familiares (€/m²),
//             últimos 12 meses, trimestral, até à freguesia (dim3 = domicílio do comprador → T)
// Códigos geográficos do INE: 7 chars = município, 9 chars = freguesia (prefixo = município).

const INE = "https://www.ine.pt/ine/json_indicador";

export const RENT_INDICATOR = "0014771";
export const SALE_INDICATOR = "0012246";

export interface IneBenchmarkRow {
  code: string;
  name: string;
  level: "freguesia" | "concelho";
  municipality: string | null;
  value: number;
}

export interface IneFetchResult {
  period: string; // ex.: "2026T1"
  periodLabel: string; // ex.: "1.º Trimestre de 2026"
  rows: IneBenchmarkRow[];
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`INE respondeu ${res.status} em ${url}`);
  return res.json();
}

/** "S5A20261" -> "2026T1"; "S7A2025" -> "2025". */
function periodKeyFromCatId(catId: string): string {
  const q = catId.match(/(\d{4})(\d)$/);
  if (q && Number(q[2]) >= 1 && Number(q[2]) <= 4) return `${q[1]}T${q[2]}`;
  const y = catId.match(/(\d{4})$/);
  return y ? y[1] : catId;
}

interface PeriodCat {
  cat_id: string;
  categ_dsg: string;
  categ_ord: string;
}

/** Último período disponível de um indicador (dimensão 1). */
export async function fetchLatestPeriod(varcd: string): Promise<{ catId: string; label: string }> {
  const meta = (await fetchJson(`${INE}/pindicaMeta.jsp?varcd=${varcd}&lang=PT`)) as Array<{
    Dimensoes?: { Categoria_Dim?: Array<Record<string, unknown>> };
  }>;
  const catDim = meta?.[0]?.Dimensoes?.Categoria_Dim?.[0];
  if (!catDim) throw new Error(`Metadados inesperados do INE para ${varcd}`);
  const periods: PeriodCat[] = [];
  for (const v of Object.values(catDim)) {
    if (Array.isArray(v) && v.length > 0) {
      const c = v[0] as Record<string, string>;
      if (c.dim_num === "1" && c.cat_id) {
        periods.push({ cat_id: c.cat_id, categ_dsg: c.categ_dsg, categ_ord: c.categ_ord ?? "0" });
      }
    }
  }
  if (periods.length === 0) throw new Error(`Sem períodos nos metadados do INE (${varcd})`);
  periods.sort((a, b) => Number(a.categ_ord) - Number(b.categ_ord));
  const last = periods[periods.length - 1];
  return { catId: last.cat_id, label: last.categ_dsg };
}

/** Dados de um indicador no período dado, filtrados a municípios e freguesias. */
export async function fetchIneIndicator(
  varcd: string,
  extraDims = "",
): Promise<IneFetchResult> {
  const { catId, label } = await fetchLatestPeriod(varcd);
  const data = (await fetchJson(
    `${INE}/pindica.jsp?op=2&varcd=${varcd}&Dim1=${catId}${extraDims}&lang=PT`,
  )) as Array<{ Dados?: Record<string, Array<Record<string, unknown>>> }>;
  const dados = data?.[0]?.Dados;
  const firstKey = dados ? Object.keys(dados)[0] : undefined;
  const rawRows = firstKey && dados ? dados[firstKey] : [];

  const municipalityName = new Map<string, string>();
  for (const r of rawRows) {
    const code = String(r.geocod ?? "");
    if (code.length === 7) municipalityName.set(code, String(r.geodsg ?? ""));
  }

  const rows: IneBenchmarkRow[] = [];
  for (const r of rawRows) {
    // dimensões extra (ex.: domicílio do comprador) — aceitar apenas o Total
    let skip = false;
    for (const [k, v] of Object.entries(r)) {
      if (/^dim_\d+$/.test(k) && String(v) !== "T") skip = true;
    }
    if (skip) continue;

    const code = String(r.geocod ?? "");
    const value = Number(r.valor);
    if (!Number.isFinite(value)) continue; // células suprimidas/sem dados
    if (code.length === 7) {
      rows.push({
        code,
        name: String(r.geodsg ?? ""),
        level: "concelho",
        municipality: String(r.geodsg ?? ""),
        value,
      });
    } else if (code.length === 9) {
      rows.push({
        code,
        name: String(r.geodsg ?? ""),
        level: "freguesia",
        municipality: municipalityName.get(code.slice(0, 7)) ?? null,
        value,
      });
    }
  }

  return { period: periodKeyFromCatId(catId), periodLabel: label, rows };
}

export async function fetchIneBenchmarks(): Promise<{
  rent: IneFetchResult;
  sale: IneFetchResult;
}> {
  const [rent, sale] = await Promise.all([
    fetchIneIndicator(RENT_INDICATOR),
    fetchIneIndicator(SALE_INDICATOR, "&Dim3=T"),
  ]);
  return { rent, sale };
}
