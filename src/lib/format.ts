// Formatação PT-PT e utilitários de meses.
// Os meses circulam como chaves "YYYY-MM-01" (1º dia do mês), sempre em string
// para evitar armadilhas de fuso horário.

const eur0 = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eur2 = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtEur(v: number | null | undefined, decimals: 0 | 2 = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "·";
  return (decimals === 0 ? eur0 : eur2).format(v);
}

export function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "·";
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

export function fmtPct(v: number | null | undefined, digits = 0, withSign = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "·";
  const s = new Intl.NumberFormat("pt-PT", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
  return withSign && v > 0 ? `+${s}` : s;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "·";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const MONTH_NAMES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export function monthLabel(key: string, withYear = true): string {
  const y = key.slice(0, 4);
  const m = parseInt(key.slice(5, 7), 10);
  const name = MONTH_NAMES[m - 1] ?? "?";
  return withYear ? `${name} ${y}` : name;
}

export function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function currentMonthKey(): string {
  return monthKeyFromDate(new Date());
}

export function addMonthsKey(key: string, delta: number): string {
  const y = parseInt(key.slice(0, 4), 10);
  const m = parseInt(key.slice(5, 7), 10) - 1 + delta;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
}

/** Últimos n meses (inclusive endKey), por ordem cronológica. */
export function lastMonthsKeys(n: number, endKey = currentMonthKey()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addMonthsKey(endKey, -i));
  return out;
}

export function endOfMonthISO(key: string): string {
  const next = addMonthsKey(key, 1);
  const d = new Date(`${next}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
