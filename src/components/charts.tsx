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
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { fmtEur, fmtPct } from "@/lib/format";
import { mesAbaixo } from "@/lib/monthcell";

// Os tokens, tal como estão em globals.css. Trocam de par com o tema sozinhos.
const TINTA = "var(--s-tinta)";
const TINTA_3 = "var(--s-tinta-3)";
const REGUA = "var(--s-regua)";
const ATENCAO = "var(--s-atencao)";
const PERDA = "var(--s-perda)";
const FUTURO = "var(--s-futuro)";

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



/**
 * O ano civil acumulado contra o mesmo ponto do ano anterior. Responde à pergunta que os
 * 12 meses móveis nunca respondem: "quanto já entrou este ano, e vamos melhor ou pior?".
 * A área cheia é o ano corrente (dinheiro confirmado, logo tinta); o ano anterior é uma
 * linha tracejada recessiva, porque é referência e não medição nova. A série do ano
 * corrente pára no mês em curso: os meses por vir vêm a `null` de propósito, para a linha
 * não cair a pique até zero e sugerir uma quebra que não existe.
 */

/**
 * O dinheiro que ENTROU, mês a mês. Barras, não linha: cada mês é uma medição fechada, e
 * uma linha entre dois meses sugere uma continuidade que não existe.
 *
 * A barra fica ÂMBAR no mês em que entrou menos do que o esperado — é a única leitura que
 * interessa aqui, e evita uma segunda série a competir com a primeira. O esperado é a
 * renda de REFERÊNCIA (o que o contrato costuma receber, líquido de retenção), nunca a
 * contratada: com a contratada, os inquilinos-empresa que retêm 25% abriam um buraco
 * permanente que não é falha de cobrança nenhuma.
 *
 * NÃO leva o líquido. As despesas do Anexo F ficam todas a 31-12 (a declaração só diz o
 * ano), e um líquido mensal desenhava um penhasco em dezembro que é artefacto da data,
 * não do negócio — ver V3.md, achado 7 da auditoria de 2026-07-29.
 */
export function FluxoMensalChart({ data }: { data: MonthlyFlowDatum[] }) {
  // A FALTA passa a ser DESENHADA, não deduzida (pedido do utilizador, 16/10: os gráficos
  // eram pouco fáceis de ler). Antes via-se a barra do recebido e uma linha tracejada por
  // cima, e cabia a quem lia medir a olho a distância entre as duas — justamente a parte
  // que interessa. Agora a barra sobe sempre até ao esperado: o que entrou a tinta cheia, o
  // que faltou em âmbar esbatido por cima. A altura total é a meta, e o bloco claro é o
  // buraco. Mantém-se a linha do esperado, que é a única coisa que ainda diz alguma coisa
  // nos meses em que se recebeu MAIS do que a referência.
  //
  // Sem grelha de fundo, de propósito (ver o cabeçalho deste ficheiro): em vez de obrigar a
  // seguir uma linha até ao eixo, os meses que ficaram aquém trazem o valor em falta
  // escrito por cima. São poucos — é esse o ponto —, por isso não se amontoam.
  // A falta só se desenha quando o mês ficou MESMO aquém (`mesAbaixo`, a tolerância de 90%
  // de cada contrato). Com `esperado - recebido > 0` cru, 10 dos 11 meses levavam tampa e
  // etiqueta, e as etiquetas sobrepunham-se num borrão — que é o mesmo alarme cego que o
  // `mesAbaixo` já tinha sido criado para matar ("era 1 € abaixo, e com 40 contratos há
  // sempre um inquilino atrasado"). Assim ficam três, e as barras voltam a ter a forma do
  // que entrou em vez de chegarem todas à meta.
  const comFalta = data.map((d) => ({ ...d, falta: mesAbaixo(d) ? Math.max(0, d.esperado - d.recebido) : 0 }));
  // UMA etiqueta, no pior mês. Com três, duas calharam em meses seguidos e sobrepuseram-se:
  // numa coluna de ~45 px não cabe "−1 200" ao lado de outro. Os restantes meses abaixo
  // continuam a ver-se pela tampa âmbar, e os valores exatos estão a um toque, em "Ver
  // valores mês a mês". Um número que se lê vale mais do que três que se atropelam.
  const pior = comFalta.reduce((melhor, d, i) => (d.falta > (comFalta[melhor]?.falta ?? 0) ? i : melhor), -1);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart accessibilityLayer data={comFalta} margin={{ top: 22, right: 16, left: 4, bottom: 0 }}>
        <XAxis dataKey="label" tick={EIXO} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v: number) => fmtEur(v)}
          tick={EIXO}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <ReferenceLine y={0} stroke={REGUA} />
        <Bar dataKey="recebido" stackId="mes" name="Recebido" isAnimationActive={false} maxBarSize={38}>
          {comFalta.map((d) => (
            // Cantos redondos só quando o recebido é o topo da barra; com falta por cima,
            // arredondar aqui abria um entalhe a meio da coluna.
            <Cell key={d.month} fill={TINTA} radius={d.falta > 0 ? 0 : ([3, 3, 0, 0] as never)} />
          ))}
        </Bar>
        <Bar
          dataKey="falta"
          stackId="mes"
          name="Faltou"
          isAnimationActive={false}
          radius={[3, 3, 0, 0]}
          maxBarSize={38}
          fill={ATENCAO}
          fillOpacity={0.38}
        >
          <LabelList dataKey="falta" content={<EtiquetaFalta pior={pior} />} />
        </Bar>
        <Line
          dataKey="esperado"
          isAnimationActive={false}
          name="Esperado"
          type="monotone"
          stroke={TINTA_3}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinecap="round"
          dot={false}
          activeDot={false}
        />
        <Tooltip content={<FlowTooltip />} cursor={{ fill: REGUA, fillOpacity: 0.35 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** O valor do ÚLTIMO ponto de uma linha, escrito ao lado dele. Um rótulo por série, logo
 *  sem risco de sobreposição — ao contrário de etiquetar todos os pontos. */
function EtiquetaFimDeLinha({
  x,
  y,
  value,
  index,
  ultimo,
}: {
  x?: number;
  y?: number;
  value?: number;
  index?: number;
  ultimo?: number;
}) {
  if (index !== ultimo || !value || x === undefined || y === undefined) return null;
  return (
    <text x={x} y={y - 8} textAnchor="end" className="tabular-nums" fontSize={11} fontWeight={600} fill={TINTA}>
      {fmtEur(value)}
    </text>
  );
}

/** O que faltou, escrito por cima da coluna. Só aparece quando faltou alguma coisa. */
function EtiquetaFalta({
  x,
  y,
  width,
  value,
  index,
  pior,
}: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
  index?: number;
  pior?: number;
}) {
  if (index !== pior || !value || value <= 0 || x === undefined || y === undefined || width === undefined)
    return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      className="tabular-nums"
      fontSize={10}
      fontWeight={500}
      fill={ATENCAO}
    >
      {/* Sem o "€": o eixo já o diz, e a etiqueta tem de caber na largura de uma coluna. */}
      {"−"}
      {Math.round(value).toLocaleString("pt-PT")}
    </text>
  );
}

export interface ProjecaoDatum {
  label: string;
  contratado: number;
  esperado: number;
  /** Base da banda (p10) e altura dela (p90 - p10): o Recharts empilha duas áreas para
   *  desenhar um intervalo, porque não tem primitiva de banda. A de baixo é invisível. */
  p10: number;
  banda: number;
}

function ProjecaoTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const v = (k: string) => payload.find((p) => p.dataKey === k)?.value;
  const p10 = v("p10");
  const banda = v("banda");
  return (
    <Balao>
      <p className="mb-1.5 font-medium text-tinta">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <SeriesSwatch color={TINTA_3} dashed />
          <span className="flex-1 text-tinta-2">Contratado</span>
          <span className="tabular-nums text-tinta-2">{fmtEur(v("contratado"))}</span>
        </div>
        <div className="flex items-center gap-3">
          <SeriesSwatch color={TINTA} />
          <span className="flex-1 text-tinta-2">Esperado</span>
          <span className="font-medium tabular-nums text-tinta">{fmtEur(v("esperado"))}</span>
        </div>
        {p10 != null && banda != null && (
          <p className="border-t border-regua pt-1 text-tinta-3">
            Entre {fmtEur(p10)} e {fmtEur(p10 + banda)}, com 90% de confiança
          </p>
        )}
      </div>
    </Balao>
  );
}

/**
 * A projeção de receita. A linha cheia é o esperado (renda contratada vezes a
 * probabilidade de cada inquilino pagar, do modelo de risco); a banda em ardósia é o
 * intervalo de credibilidade; o tracejado é o contratado, ou seja, o que entraria se
 * todos pagassem sempre. A distância entre o tracejado e a linha É o risco de crédito,
 * desenhado, e a queda do tracejado ao longo do tempo são os contratos a expirar.
 *
 * Ardósia porque é futuro: a app ainda não sabe. É o mesmo vocabulário de cor da faixa,
 * onde tudo o que está além da fronteira dos dados é ardósia e hachura.
 */
export function ProjecaoChart({ data }: { data: ProjecaoDatum[] }) {
  // O mesmo princípio do gráfico do Hoje (16/10): o número onde interessa, em vez de se
  // seguir a linha até ao eixo. Aqui o que interessa é ONDE a projeção aterra, por isso a
  // etiqueta vai no último ponto — um só rótulo, que nunca se pode sobrepor a outro.
  const ultimo = data.length - 1;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart accessibilityLayer data={data} margin={{ top: 22, right: 16, left: 4, bottom: 0 }}>
        <XAxis dataKey="label" tick={EIXO} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis
          tickFormatter={(v: number) => fmtEur(v)}
          tick={EIXO}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <ReferenceLine y={0} stroke={REGUA} />
        <Area dataKey="p10" stackId="banda" stroke="none" fill="none" isAnimationActive={false} />
        <Area
          dataKey="banda"
          stackId="banda"
          stroke="none"
          fill={FUTURO}
          fillOpacity={0.18}
          isAnimationActive={false}
        />
        <Line
          dataKey="contratado"
          isAnimationActive={false}
          name="Contratado"
          type="monotone"
          stroke={TINTA_3}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          activeDot={false}
        />
        <Line
          dataKey="esperado"
          isAnimationActive={false}
          name="Esperado"
          type="monotone"
          stroke={TINTA}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: TINTA, stroke: "none" }}
        >
          <LabelList dataKey="esperado" content={<EtiquetaFimDeLinha ultimo={ultimo} />} />
        </Line>
        <Tooltip content={<ProjecaoTooltip />} cursor={{ stroke: REGUA }} />
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

