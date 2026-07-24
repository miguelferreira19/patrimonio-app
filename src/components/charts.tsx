"use client";

// Gráficos do dashboard (Recharts exige client component).
// Cores seguem a skill dataviz: um único hue de destaque (o teal-700 já usado em
// toda a app, ~5.6:1 em branco) para a série "principal", cinzentos zinc para
// contexto/derivados (sem custo de CVD — são acromáticos) e a paleta de estado fixa
// (verde/âmbar/vermelho) reservada só para a taxa de cobrança, onde a cor É de facto
// um estado (cumpriu/não cumpriu a meta) — nunca reutilizada para "despesas", que é
// um fluxo normal, não um estado de erro. Grelhas em cinza sólido hairline (nunca
// tracejadas); só a linha de referência "esperado"/"meta" é tracejada, de propósito.

import { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { fmtEur, fmtPct } from "@/lib/format";

// ---------- Paleta ----------
// Recharts pinta SVG com cores passadas por prop (fill/stroke) — não segue classes
// `dark:`. P3-3: cada cor "de fundo" (grelha, texto de eixo, referência tracejada, e o
// próprio hue da barra principal) tem um par light/dark, escolhido por `useIsDark()`
// (matchMedia nativo, sem dependência nova). A paleta de ESTADO (bom/aviso/crítico) fica
// FIXA nos dois temas — vem de dataviz/references/palette.md e não é "fundo", é o
// significado em si (mudar por tema tornaria a leitura inconsistente entre ecrãs).
const PALETTE_LIGHT = {
  recebido: "#0f766e", // teal-700 — accent da app; contraste ~5.6:1 em branco
  liquidoBar: "rgba(15,118,110,0.42)",
  esperado: "#a1a1aa", // zinc-400 — referência tracejada, recessiva por design
  grid: "#e4e4e7", // zinc-200 — grelha/eixo hairline
  mutedText: "#71717a", // zinc-500 — texto de eixos
};
const PALETTE_DARK = {
  recebido: "#2dd4bf", // teal-400 — mais claro para não ficar baço no fundo escuro
  liquidoBar: "rgba(45,212,191,0.42)", // mesmo hue, mesma lógica: 42% = "sobra depois das despesas"
  esperado: "#71717a", // zinc-500 — continua recessivo, agora contra fundo escuro
  grid: "#27272a", // zinc-800 — hairline discreta em fundo escuro
  mutedText: "#a1a1aa", // zinc-400 — legível em fundo escuro
};

/** matchMedia nativo — sem seletor manual na app, só segue o SO/browser (ver P3-3). */
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDark;
}

// Paleta de estado fixa (dataviz/references/palette.md) — reservada à taxa de cobrança,
// que é genuinamente um estado (cumpriu/não cumpriu), ao contrário de despesas/líquido.
const COLOR_GOOD = "#0ca30c";
const COLOR_WARNING = "#fab219";
const COLOR_CRITICAL = "#d03b3b";

const SERIES_ORDER: Record<string, number> = {
  recebido: 0,
  liquido: 1,
  esperado: 2,
};

export interface MonthlyFlowDatum {
  month: string;
  label: string;
  esperado: number;
  recebido: number;
  liquido: number;
}

export interface CollectionRateDatum {
  label: string;
  taxa: number;
}

// Pequena chave em linha (nunca uma caixa) para identificar a série no tooltip —
// mais leve visualmente à densidade do tooltip; tracejada para "esperado".
function SeriesSwatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width="14" height="8" className="shrink-0" aria-hidden="true">
      <line
        x1="0"
        y1="4"
        x2="14"
        y2="4"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? "3 2" : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

function FlowTooltip({ active, payload, label }: TooltipProps<number, string>) {
  const palette = useIsDark() ? PALETTE_DARK : PALETTE_LIGHT;
  if (!active || !payload || payload.length === 0) return null;
  const sorted = [...payload].sort(
    (a, b) => (SERIES_ORDER[String(a.dataKey)] ?? 9) - (SERIES_ORDER[String(b.dataKey)] ?? 9),
  );
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-1.5 font-semibold text-zinc-900 dark:text-zinc-100">{label}</p>
      <div className="space-y-1">
        {sorted.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center gap-2">
            <SeriesSwatch color={entry.color ?? palette.mutedText} dashed={entry.dataKey === "esperado"} />
            <span className="flex-1 text-zinc-500 dark:text-zinc-400">{entry.name}</span>
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{fmtEur(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Legenda do gráfico de fluxo, para o header do cartão (o cliente pediu-a lá em cima). */
export function FlowLegend() {
  const palette = useIsDark() ? PALETTE_DARK : PALETTE_LIGHT;
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: palette.recebido }} />
        Bruto
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: palette.liquidoBar }} />
        Líquido
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: palette.esperado }} />
        Esperado
      </span>
    </div>
  );
}

/**
 * Gráfico principal do dashboard: 12 meses, barras Bruto (recebido) vs Líquido
 * (recebido − despesas) e referência tracejada para o esperado — tudo em € num só eixo.
 * A série "Despesas" saiu por pedido do cliente: o que interessa comparar é quanto
 * entrou e quanto sobrou, e a despesa já está implícita na distância entre as duas barras.
 */
export function MonthlyFlowChart({ data }: { data: MonthlyFlowDatum[] }) {
  const palette = useIsDark() ? PALETTE_DARK : PALETTE_LIGHT;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={palette.grid} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: palette.mutedText }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => fmtEur(v)}
          tick={{ fontSize: 12, fill: palette.mutedText }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <ReferenceLine y={0} stroke={palette.grid} />
        <Bar dataKey="recebido" name="Bruto" fill={palette.recebido} radius={[3, 3, 0, 0]} barSize={18} />
        <Bar dataKey="liquido" name="Líquido" fill={palette.liquidoBar} radius={[3, 3, 0, 0]} barSize={18} />
        <Line
          dataKey="esperado"
          name="Esperado"
          type="monotone"
          stroke={palette.esperado}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={false}
        />
        <Tooltip content={<FlowTooltip />} cursor={{ fill: palette.grid, opacity: 0.5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export interface ArrearsFlowDatum {
  label: string;
  esperado: number;
  recebido: number;
}

const ARREARS_SERIES_ORDER: Record<string, number> = {
  recebido: 0,
  esperado: 1,
};

function ArrearsFlowTooltip({ active, payload, label }: TooltipProps<number, string>) {
  const palette = useIsDark() ? PALETTE_DARK : PALETTE_LIGHT;
  if (!active || !payload || payload.length === 0) return null;
  const sorted = [...payload].sort(
    (a, b) => (ARREARS_SERIES_ORDER[String(a.dataKey)] ?? 9) - (ARREARS_SERIES_ORDER[String(b.dataKey)] ?? 9),
  );
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-1.5 font-semibold text-zinc-900 dark:text-zinc-100">{label}</p>
      <div className="space-y-1">
        {sorted.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center gap-2">
            <SeriesSwatch color={entry.color ?? palette.mutedText} dashed={entry.dataKey === "esperado"} />
            <span className="flex-1 text-zinc-500 dark:text-zinc-400">{entry.name}</span>
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{fmtEur(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Página de Atrasos: recebido real (barras) vs. esperado (linha tracejada — aproximação
 * pelas rendas atuais dos contratos ativos, constante nos 12 meses). Mesma convenção do
 * MonthlyFlowChart: tracejado = esperado.
 */
export function ArrearsFlowChart({ data }: { data: ArrearsFlowDatum[] }) {
  const palette = useIsDark() ? PALETTE_DARK : PALETTE_LIGHT;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={palette.grid} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: palette.mutedText }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => fmtEur(v)}
          tick={{ fontSize: 12, fill: palette.mutedText }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <ReferenceLine y={0} stroke={palette.grid} />
        <Bar dataKey="recebido" name="Recebido" fill={palette.recebido} radius={[4, 4, 0, 0]} barSize={22} />
        <Line
          dataKey="esperado"
          name="Esperado"
          type="monotone"
          stroke={palette.esperado}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={false}
        />
        <Tooltip content={<ArrearsFlowTooltip />} cursor={{ fill: palette.grid, opacity: 0.5 }} />
        <Legend
          verticalAlign="bottom"
          align="center"
          iconSize={10}
          wrapperStyle={{ fontSize: 12, color: palette.mutedText, paddingTop: 12 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function rateColor(taxa: number): string {
  if (taxa >= 1) return COLOR_GOOD;
  if (taxa >= 0.8) return COLOR_WARNING;
  return COLOR_CRITICAL;
}

function RateTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{label}</p>
      <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">
        Taxa de cobrança:{" "}
        <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{fmtPct(value, 0)}</span>
      </p>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Mini gráfico da taxa de cobrança mensal (recebido/esperado). A cor por barra é um
 * estado (cumpriu/quase/falhou a meta), não uma identidade de série — por isso usa a
 * paleta de estado fixa em vez de um hue categórico, sempre acompanhada da legenda
 * por baixo (cor nunca sozinha a transmitir o significado).
 */
export function CollectionRateChart({ data }: { data: CollectionRateDatum[] }) {
  const palette = useIsDark() ? PALETTE_DARK : PALETTE_LIGHT;
  const yMax = Math.max(1, ...data.map((d) => d.taxa)) * 1.05;

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={palette.grid} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: palette.mutedText }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, yMax]}
            ticks={[0, 0.5, 1]}
            tickFormatter={(v: number) => fmtPct(v, 0)}
            tick={{ fontSize: 11, fill: palette.mutedText }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <ReferenceLine y={1} stroke={palette.esperado} strokeDasharray="3 2" />
          <Tooltip content={<RateTooltip />} cursor={{ fill: palette.grid, opacity: 0.4 }} />
          <Bar dataKey="taxa" name="Taxa de cobrança" fill={COLOR_GOOD} radius={[4, 4, 0, 0]} barSize={16}>
            {data.map((d) => (
              <Cell key={d.label} fill={rateColor(d.taxa)} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        <LegendChip color={COLOR_GOOD} label="≥ 100%" />
        <LegendChip color={COLOR_WARNING} label="80–99%" />
        <LegendChip color={COLOR_CRITICAL} label="< 80%" />
      </div>
    </div>
  );
}
