"use client";

// Gráficos (Recharts exige client component).
//
// V3: este ficheiro tinha uma paleta própria em hex, duplicada light/dark, e um
// `useIsDark()` com matchMedia para escolher entre as duas. Passou a ler os MESMOS tokens
// semânticos do resto da app (`--s-*` em globals.css): o Recharts pinta atributos SVG, e
// `stroke="var(--s-tinta)"` resolve no browser como qualquer outra propriedade CSS. O tema
// deixa de ser decidido em JavaScript, e um gráfico nunca mais pode discordar da página em
// que está.
//
// Corrige também uma violação da regra fundadora: a taxa de cobrança tinha um verde de
// "bom" (#0ca30c). Não há verde de "ok" nesta app — um mês cobrado a 100% é TINTA, calado,
// como o resto do que está confirmado. A cor só entra quando há atenção (âmbar) ou perda
// (vermelho), que é quando quer dizer alguma coisa.
//
// A grelha de fundo saiu: a separação nesta app é por hairline, e uma grelha atrás das
// barras é chrome a competir com os dados. Fica só a linha do zero e a da meta.

import {
  Area,
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { fmtEur, fmtPct } from "@/lib/format";

// Os tokens, tal como estão em globals.css. Trocam de par com o tema sozinhos.
const TINTA = "var(--s-tinta)";
const TINTA_3 = "var(--s-tinta-3)";
const REGUA = "var(--s-regua)";
const ATENCAO = "var(--s-atencao)";
const PERDA = "var(--s-perda)";

const EIXO = { fontSize: 12, fill: TINTA_3 } as const;

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

// Chave em linha (nunca uma caixa) para identificar a série no tooltip: mais leve à
// densidade do tooltip. Tracejada para "esperado", que é referência e não medição.
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

function Balao({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-regua bg-elevado px-3 py-2 text-xs shadow-sm">
      {children}
    </div>
  );
}

function FlowTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const sorted = [...payload].sort(
    (a, b) => (SERIES_ORDER[String(a.dataKey)] ?? 9) - (SERIES_ORDER[String(b.dataKey)] ?? 9),
  );
  return (
    <Balao>
      <p className="mb-1.5 font-medium text-tinta">{label}</p>
      <div className="space-y-1">
        {sorted.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center gap-2">
            <SeriesSwatch color={entry.color ?? TINTA_3} dashed={entry.dataKey === "esperado"} />
            <span className="flex-1 text-tinta-2">{entry.name}</span>
            <span className="font-medium tabular-nums text-tinta">{fmtEur(entry.value)}</span>
          </div>
        ))}
      </div>
    </Balao>
  );
}

/** Legenda do fluxo, para o cabeçalho da secção. */
export function FlowLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-tinta-3">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TINTA }} />
        Bruto
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px] opacity-40" style={{ background: TINTA }} />
        Líquido
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: TINTA_3 }} />
        Esperado
      </span>
    </div>
  );
}

/**
 * Doze meses: barras do bruto recebido e do líquido (recebido menos despesas), com o
 * esperado como referência tracejada. O que entrou é dinheiro confirmado, logo é tinta;
 * o esperado é referência, logo é recessivo. A despesa não tem série própria: está na
 * distância entre as duas barras.
 */
export function MonthlyFlowChart({ data }: { data: MonthlyFlowDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }} barGap={2} barCategoryGap="22%">
        <XAxis dataKey="label" tick={EIXO} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v: number) => fmtEur(v)}
          tick={EIXO}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <ReferenceLine y={0} stroke={REGUA} />
        <Bar dataKey="recebido" name="Bruto" fill={TINTA} radius={[3, 3, 0, 0]} barSize={18} />
        <Bar
          dataKey="liquido"
          name="Líquido"
          fill={TINTA}
          fillOpacity={0.4}
          radius={[3, 3, 0, 0]}
          barSize={18}
        />
        <Line
          dataKey="esperado"
          name="Esperado"
          type="monotone"
          stroke={TINTA_3}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={false}
        />
        <Tooltip content={<FlowTooltip />} cursor={{ fill: REGUA, opacity: 0.5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export interface AcumuladoDatum {
  label: string;
  esteAno: number | null;
  anoAnterior: number;
}

function AcumuladoTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const este = payload.find((p) => p.dataKey === "esteAno")?.value;
  const anterior = payload.find((p) => p.dataKey === "anoAnterior")?.value;
  const delta = este != null && anterior != null ? este - anterior : null;
  return (
    <Balao>
      <p className="mb-1.5 font-medium text-tinta">Até {label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <SeriesSwatch color={TINTA} />
          <span className="flex-1 text-tinta-2">Este ano</span>
          <span className="font-medium tabular-nums text-tinta">{fmtEur(este)}</span>
        </div>
        <div className="flex items-center gap-3">
          <SeriesSwatch color={TINTA_3} dashed />
          <span className="flex-1 text-tinta-2">Ano anterior</span>
          <span className="tabular-nums text-tinta-2">{fmtEur(anterior)}</span>
        </div>
        {delta != null && (
          <p className="border-t border-regua pt-1 tabular-nums" style={{ color: delta < 0 ? PERDA : undefined }}>
            {delta >= 0 ? "+" : ""}
            {fmtEur(delta)} face ao ano passado
          </p>
        )}
      </div>
    </Balao>
  );
}

/**
 * O ano civil acumulado contra o mesmo ponto do ano anterior. Responde à pergunta que os
 * 12 meses móveis nunca respondem: "quanto já entrou este ano, e vamos melhor ou pior?".
 * A área cheia é o ano corrente (dinheiro confirmado, logo tinta); o ano anterior é uma
 * linha tracejada recessiva, porque é referência e não medição nova. A série do ano
 * corrente pára no mês em curso: os meses por vir vêm a `null` de propósito, para a linha
 * não cair a pique até zero e sugerir uma quebra que não existe.
 */
export function AcumuladoChart({ data }: { data: AcumuladoDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <XAxis dataKey="label" tick={EIXO} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v: number) => fmtEur(v)}
          tick={EIXO}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <ReferenceLine y={0} stroke={REGUA} />
        <Area
          dataKey="esteAno"
          name="Este ano"
          type="monotone"
          stroke={TINTA}
          strokeWidth={2}
          fill={TINTA}
          fillOpacity={0.1}
          connectNulls={false}
          dot={false}
          activeDot={{ r: 3, fill: TINTA, stroke: "none" }}
        />
        <Line
          dataKey="anoAnterior"
          name="Ano anterior"
          type="monotone"
          stroke={TINTA_3}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinecap="round"
          dot={false}
          activeDot={false}
        />
        <Tooltip content={<AcumuladoTooltip />} cursor={{ stroke: REGUA }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Um mês cobrado por inteiro não merece cor. Só a falta é que fala. */
function corDaTaxa(taxa: number): string {
  if (taxa >= 1) return TINTA;
  if (taxa >= 0.8) return ATENCAO;
  return PERDA;
}

function RateTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <Balao>
      <p className="font-medium text-tinta">{label}</p>
      <p className="mt-0.5 text-tinta-2">
        Cobrado:{" "}
        <span className="font-medium tabular-nums text-tinta">{fmtPct(payload[0]?.value, 0)}</span>
      </p>
    </Balao>
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
 * Taxa de cobrança mensal. A cor aqui é um estado, não a identidade de uma série, por isso
 * varia por barra; mas o estado "cumpriu" é ausência de cor. A legenda por baixo garante
 * que a cor nunca é a única coisa a transmitir o significado.
 */
export function CollectionRateChart({ data }: { data: CollectionRateDatum[] }) {
  const yMax = Math.max(1, ...data.map((d) => d.taxa)) * 1.05;

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }} barCategoryGap="28%">
          <XAxis dataKey="label" tick={{ ...EIXO, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, yMax]}
            ticks={[0, 0.5, 1]}
            tickFormatter={(v: number) => fmtPct(v, 0)}
            tick={{ ...EIXO, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <ReferenceLine y={1} stroke={TINTA_3} strokeDasharray="3 2" />
          <Tooltip content={<RateTooltip />} cursor={{ fill: REGUA, opacity: 0.4 }} />
          <Bar dataKey="taxa" name="Cobrado" radius={[4, 4, 0, 0]} barSize={16}>
            {data.map((d) => (
              <Cell key={d.label} fill={corDaTaxa(d.taxa)} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-tinta-3">
        <LegendChip color={TINTA} label="tudo cobrado" />
        <LegendChip color={ATENCAO} label="80 a 99%" />
        <LegendChip color={PERDA} label="abaixo de 80%" />
      </div>
    </div>
  );
}
