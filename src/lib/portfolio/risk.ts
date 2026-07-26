// Risco: probabilidade de pagar, curva de cura, perda esperada e estágios (PLANO.md §6.2-6.3).
//
// Módulo PURO. Zero dependências novas, zero chamadas a modelos: é aritmética que cabe
// num ficheiro e que se prova no `risk.check.ts`.
//
// A razão de existir: a V1 chamava "dívida" a `streak × renda`. Isso conta como perdido
// dinheiro que historicamente ENTRA — nesta carteira, a maior parte do que está em falta
// há um mês aparece no import seguinte. Uma PD construída sobre essa dívida ingénua
// herdaria o erro inteiro. Aqui a perda esperada desconta duas coisas medidas nos dados
// da própria carteira: a fiabilidade do inquilino e a fração que costuma curar-se.

/** Prior da carteira, em unidades Beta. `n0 = alpha0 + beta0` é a força do prior: quantos
 *  meses de histórico valem tanto como a informação que ele já carrega. */
export interface PriorCarteira {
  alpha0: number;
  beta0: number;
  /** Média do prior = taxa de liquidação típica da carteira. */
  media: number;
  /** Contratos que entraram no ajuste. Abaixo de 3 não há variância para estimar. */
  base: number;
}

/** Concentração mínima do prior. Com poucos contratos ou variância quase nula o ajuste por
 *  momentos dispara para valores absurdos (n0 → ∞) ou colapsa (n0 → 0); este intervalo
 *  mantém o shrinkage num regime defensável — 8 meses de histórico começam a pesar mais
 *  que o prior, 400 nunca deixam um contrato individual dominar a carteira. */
export const N0_MIN = 8;
export const N0_MAX = 400;

/** Prior de recurso quando não há carteira suficiente para ajustar (< 3 contratos com
 *  meses devidos). 0,9 é a taxa de liquidação típica de arrendamento residencial; fica
 *  fraco de propósito (n0 = N0_MIN) para que os dados reais o dominem depressa. */
const PRIOR_FALLBACK: PriorCarteira = {
  alpha0: 0.9 * N0_MIN,
  beta0: 0.1 * N0_MIN,
  media: 0.9,
  base: 0,
};

/**
 * Ajuste do prior por MOMENTOS à distribuição das taxas de liquidação dos contratos.
 *
 * É isto que faz o shrinkage ter sentido: se os 43 contratos da carteira liquidam quase
 * todos 95-100% dos meses, a variância é pequena, `n0` é grande, e um contrato com 2 meses
 * de histórico fica praticamente na média da carteira — que é a conclusão honesta, porque
 * 2 meses não distinguem ninguém. Se as taxas forem dispersas, `n0` é pequeno e cada
 * contrato fala mais depressa por si.
 */
export function priorDaCarteira(
  contratos: Array<{ liquidados: number; devidos: number }>,
): PriorCarteira {
  const taxas = contratos.filter((c) => c.devidos > 0).map((c) => c.liquidados / c.devidos);
  if (taxas.length < 3) return PRIOR_FALLBACK;

  const m = taxas.reduce((a, t) => a + t, 0) / taxas.length;
  const v = taxas.reduce((a, t) => a + (t - m) ** 2, 0) / taxas.length;

  // Sem variância (ou com média degenerada) não há momentos para ajustar: fica o prior na
  // média observada, com a força mínima.
  if (!(v > 0) || m <= 0 || m >= 1) {
    const media = Math.min(0.999, Math.max(0.001, m || PRIOR_FALLBACK.media));
    return { alpha0: media * N0_MIN, beta0: (1 - media) * N0_MIN, media, base: taxas.length };
  }

  const n0 = Math.min(N0_MAX, Math.max(N0_MIN, (m * (1 - m)) / v - 1));
  return { alpha0: m * n0, beta0: (1 - m) * n0, media: m, base: taxas.length };
}

export interface PPagar {
  /** Posterior Beta-Binomial. NUNCA se mostra sem o `n` ao lado. */
  p: number;
  /** Meses devidos observados. É a única defesa contra ler 100% de dois meses como certeza. */
  n: number;
  /** Intervalo de credibilidade a 90%, por aproximação normal ao posterior Beta. */
  lo: number;
  hi: number;
}

/**
 * Peso que os dados do PRÓPRIO contrato têm no posterior: `w = n / (n₀ + n)`.
 *
 * É a forma exata do shrinkage, e é o que se deve testar — não uma distância fixa ao
 * prior. O posterior é sempre `p̂ = w·taxa_observada + (1−w)·média_do_prior`, por isso
 * `w` diz, num número, quanto é que a app está a acreditar neste contrato em vez de na
 * carteira. Com n=2 e um n₀ típico desta carteira (~31), `w` ≈ 0,06: dois meses valem 6%
 * da opinião, e os outros 94% continuam a ser a carteira.
 */
export function pesoDosDados(devidos: number, prior: PriorCarteira): number {
  const n0 = prior.alpha0 + prior.beta0;
  return devidos <= 0 ? 0 : devidos / (n0 + devidos);
}

/** Posterior `p̂ = (α₀ + liquidados) / (α₀ + β₀ + devidos)`. */
export function pPagar(liquidados: number, devidos: number, prior: PriorCarteira): PPagar {
  const a = prior.alpha0 + Math.max(0, liquidados);
  const b = prior.beta0 + Math.max(0, devidos - Math.max(0, liquidados));
  const p = a / (a + b);
  // Desvio-padrão do Beta; 1,645σ ≈ 90%. Chega para dizer "não sabemos" quando n é baixo.
  const sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  return {
    p,
    n: devidos,
    lo: Math.max(0, p - 1.645 * sd),
    hi: Math.min(1, p + 1.645 * sd),
  };
}

/**
 * Curva de cura: dada uma falta com `k` meses de idade, que fração acaba por ser paga?
 *
 * Medida nos atrasos de pagamento da própria carteira — `received_date − ref_month`, em
 * meses. Um mês que foi pago com atraso de 3 meses é evidência de que faltas com 0, 1 e 2
 * meses de idade ainda curam.
 *
 * Devolve um vetor onde `cura[k]` é a fração dos meses em falta há k meses que ainda
 * acabaram pagos. É monótona não-crescente por construção.
 */
export function curvaDeCura(atrasosEmMeses: number[], maxK = 12): number[] {
  const cura = new Array(maxK + 1).fill(0);
  const total = atrasosEmMeses.length;
  if (total === 0) {
    // Sem histórico de atrasos NÃO se inventa cura: zero é a hipótese conservadora e faz
    // a perda esperada cair na estimativa ingénua, que é o comportamento honesto.
    return cura;
  }
  for (let k = 0; k <= maxK; k++) {
    cura[k] = atrasosEmMeses.filter((d) => d > k).length / total;
  }
  return cura;
}

/** `cura(k)` com extrapolação: além do fim da curva medida, a cura é a do último ponto. */
export function cura(curva: number[], k: number): number {
  if (curva.length === 0) return 0;
  return curva[Math.min(Math.max(0, Math.round(k)), curva.length - 1)];
}

/** Estágio IFRS 9. Os buckets de severidade da V1 já eram isto sem o dizerem. */
export type Estagio = 1 | 2 | 3;

export const ESTAGIO_LABEL: Record<Estagio, string> = {
  1: "Normal",
  2: "Deterioração",
  3: "Incumprimento",
};

/** 1 normal · 2 deterioração (1-2 meses) · 3 incumprimento (3+ meses, a convenção de 90
 *  dias). `semHistorico` não é incumprimento: é desconhecimento, e cai em deterioração. */
export function estagioDe({
  streak,
  semHistorico,
}: {
  streak: number;
  semHistorico: boolean;
}): Estagio {
  if (streak >= 3) return 3;
  if (streak >= 1 || semHistorico) return 2;
  return 1;
}

export interface PerdaContrato {
  contractId: string;
  p: PPagar;
  estagio: Estagio;
  /** `streak × renda` — o que a V1 chamava dívida. Fica para se poder mostrar a diferença. */
  ingenua: number;
  /** Σ valor_mês × (1 − cura(idade)) × (1 − p̂). */
  esperada: number;
}

/**
 * Perda esperada de um contrato.
 *
 * Cada mês em falta entra descontado por DUAS coisas independentes: a fração que
 * historicamente ainda cura àquela idade, e a fiabilidade do próprio inquilino. Um mês em
 * falta há 1 mês de um inquilino que sempre pagou vale quase zero de perda; o mesmo mês de
 * um inquilino com metade dos meses por liquidar vale quase tudo.
 */
export function perdaDoContrato({
  contractId,
  faltas,
  liquidados,
  devidos,
  streak,
  semHistorico,
  prior,
  curva,
}: {
  contractId: string;
  /** Um por mês em falta: quanto valia e há quantos meses venceu. */
  faltas: Array<{ valor: number; idadeMeses: number }>;
  liquidados: number;
  devidos: number;
  streak: number;
  semHistorico: boolean;
  prior: PriorCarteira;
  curva: number[];
}): PerdaContrato {
  const p = pPagar(liquidados, devidos, prior);
  const esperada = faltas.reduce(
    (acc, f) => acc + f.valor * (1 - cura(curva, f.idadeMeses)) * (1 - p.p),
    0,
  );
  return {
    contractId,
    p,
    estagio: estagioDe({ streak, semHistorico }),
    ingenua: faltas.reduce((acc, f) => acc + f.valor, 0),
    esperada,
  };
}

export interface RiscoCarteira {
  prior: PriorCarteira;
  curva: number[];
  contratos: PerdaContrato[];
  /** Σ perda esperada. É o número que substitui a "dívida" da V1. */
  esperada: number;
  /** Σ perda ingénua, para a frase de calibração. */
  ingenua: number;
  /** € por estágio, para as barras. */
  porEstagio: Record<Estagio, number>;
}

export function resumirRisco(contratos: PerdaContrato[], prior: PriorCarteira, curva: number[]): RiscoCarteira {
  const porEstagio: Record<Estagio, number> = { 1: 0, 2: 0, 3: 0 };
  for (const c of contratos) porEstagio[c.estagio] += c.esperada;
  return {
    prior,
    curva,
    contratos,
    esperada: contratos.reduce((a, c) => a + c.esperada, 0),
    ingenua: contratos.reduce((a, c) => a + c.ingenua, 0),
    porEstagio,
  };
}

/**
 * A frase de calibração — a app a descontar-se a si própria em voz alta (PLANO.md §6.3).
 *
 * Só se diz quando há diferença material entre as duas estimativas: repetir "1.940 €; a
 * ingénua diria 1.940 €" seria ruído.
 */
export function fraseDeCalibracao(
  r: RiscoCarteira,
  fmt: (v: number) => string,
): string | null {
  if (r.ingenua <= 0 || r.esperada <= 0) return null;
  if (r.ingenua - r.esperada < 1) return null;
  const cura1 = cura(r.curva, 1);
  const base =
    `${fmt(r.esperada)} de perda esperada; a estimativa ingénua diria ${fmt(r.ingenua)}.`;
  if (!(cura1 > 0)) return base;
  return `${base} ${Math.round(cura1 * 100)}% do que está em falta há um mês costuma resolver-se sozinho no import seguinte.`;
}
