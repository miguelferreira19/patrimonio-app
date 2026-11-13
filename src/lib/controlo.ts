import { toMonthKey } from "./arrears";
import { addMonthsKey, monthLabel, nomeProprio } from "./format";
import { rentInMonth } from "./gestao";
import type { Contract, RentUpdate } from "./types";

export type Observacao = {
  receiptKey: string; contrato: string; conta: string; periodStart: string; periodEnd: string;
  receivedDate: string | null; amount: number; withholding: number;
  state: "emitido" | "anulado"; firstSeen: string | null;
};
export type ContratoDoControlo = Contract & { atualizacoes: RentUpdate[]; empresa: boolean };
export type TipoDeSinal = "emissao_tardia" | "lote" | "anulado_sem_substituto" |
  "anulado_reemitido" | "valor_diferente" | "retencao_inconsistente" | "mes_saltado" |
  "data_estranha" | "atraso_sem_contacto";
export type Sinal = {
  id: string; tipo: TipoDeSinal; gravidade: 1 | 2 | 3; contrato: string; inquilino: string;
  conta: string; dia: string; texto: string; valor?: number; dias?: number;
};
export type ContextoDoControlo = {
  contratos: ContratoDoControlo[]; hoje: string;
  /** Chaves dos dois mapas: id interno do contrato. */
  ultimoContactoPorContrato: Map<string, string>;
  mesesEmAtrasoPorContrato: Map<string, number>;
};
type Indexada = { obs: Observacao; meses: string[] };
type Extra = Partial<Pick<Sinal, "dia" | "valor" | "dias">>;
const TIPOS: TipoDeSinal[] = ["emissao_tardia", "lote", "anulado_sem_substituto",
  "anulado_reemitido", "valor_diferente", "retencao_inconsistente", "mes_saltado",
  "data_estranha", "atraso_sem_contacto"];
const centimos = (v: number) => Math.round(v * 100);
const diaDaObservacao = (o: Observacao) => o.firstSeen ?? o.receivedDate ?? o.periodStart;
const diasEntre = (a: string, b: string) =>
  (Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86400000;

function mesesDoRecibo(o: Observacao): string[] {
  if (!o.periodStart || !o.periodEnd || o.periodEnd < o.periodStart) return [];
  const fim = toMonthKey(o.periodEnd), meses: string[] = [];
  for (let mes = toMonthKey(o.periodStart); mes <= fim; mes = addMonthsKey(mes, 1)) meses.push(mes);
  return meses;
}
function indexar(obs: Observacao[]): Indexada[] {
  const unicas = new Map(obs.map((o) => [`${o.receiptKey}:${o.state}`, o]));
  return [...unicas.values()].sort((a, b) =>
    a.receiptKey.localeCompare(b.receiptKey) || a.state.localeCompare(b.state))
    .map((o) => ({ obs: o, meses: mesesDoRecibo(o) }));
}
function criar(o: Observacao, c: ContratoDoControlo | undefined, tipo: TipoDeSinal,
  gravidade: Sinal["gravidade"], texto: string, extra: Extra = {}): Sinal {
  return { id: `${tipo}:${o.receiptKey}`, tipo, gravidade, contrato: o.contrato,
    inquilino: nomeProprio(c?.tenant_name), conta: o.conta,
    dia: diaDaObservacao(o), texto, ...extra };
}
function parcela(r: Indexada, mes: string): number {
  const i = r.meses.indexOf(mes);
  if (i < 0) return 0;
  const total = centimos(r.obs.amount), base = Math.trunc(total / r.meses.length);
  return i === r.meses.length - 1 ? total - base * i : base;
}
function totaisMensais(recibos: Indexada[]): Map<string, number> {
  const totais = new Map<string, number>();
  for (const r of recibos) for (const mes of r.meses) {
    totais.set(mes, (totais.get(mes) ?? 0) + parcela(r, mes));
  }
  return totais;
}

function sinaisDeDatas(r: Indexada, c: ContratoDoControlo | undefined, hoje: string): Sinal[] {
  const o = r.obs, saida: Sinal[] = [];
  if (o.state === "emitido" && o.firstSeen && o.receivedDate) {
    const dias = diasEntre(o.receivedDate, o.firstSeen);
    if (dias > 10) saida.push(criar(o, c, "emissao_tardia", dias > 30 ? 2 : 1,
      `O recibo da conta ${o.conta} apareceu ${dias} dias depois do recebimento, com precisão de 3 a 4 dias devido às recolhas à segunda e à quinta.`,
      { dias }));
  }
  if (o.receivedDate && (o.receivedDate > hoje ||
    (o.periodStart && diasEntre(o.receivedDate, o.periodStart) > 31))) {
    saida.push(criar(o, c, "data_estranha", 1,
      o.receivedDate > hoje ? `O recibo da conta ${o.conta} tem uma data de recebimento no futuro.` :
        `O recibo da conta ${o.conta} tem uma data de recebimento mais de 31 dias anterior ao período.`,
      { dia: o.receivedDate }));
  }
  return saida;
}
function sinaisDeLotes(recibos: Indexada[], c: ContratoDoControlo | undefined): Sinal[] {
  const lotes = new Map<string, Indexada[]>();
  for (const r of recibos) if (r.obs.state === "emitido" && r.obs.firstSeen) {
    const grupo = lotes.get(r.obs.firstSeen) ?? [];
    grupo.push(r);
    lotes.set(r.obs.firstSeen, grupo);
  }
  return [...lotes.values()].flatMap((lote) => {
    const meses = new Set(lote.flatMap((r) => r.meses));
    return lote.length >= 3 && meses.size >= 3 ? [criar(lote[0].obs, c, "lote", 2,
      `A conta ${lote[0].obs.conta} apresentou ${lote.length} recibos de ${meses.size} meses na mesma recolha.`)] : [];
  });
}
function sinalDeAnulacao(r: Indexada, emitidos: Indexada[], c: ContratoDoControlo | undefined): Sinal[] {
  if (!r.meses.length) return [];
  const o = r.obs;
  const novos = emitidos.filter((e) => e.obs.receiptKey !== o.receiptKey &&
    e.meses.some((mes) => r.meses.includes(mes)));
  const descobertos = r.meses.filter((mes) => !novos.some((e) => e.meses.includes(mes)));
  if (descobertos.length) {
    const texto = descobertos.length === 1 ?
      `${monthLabel(descobertos[0])} sem substituto e o mês voltou a estar por pagar` :
      `os meses ${descobertos.map((m) => monthLabel(m)).join(", ")} sem substituto e voltaram a estar por pagar`;
    return [criar(o, c, "anulado_sem_substituto", 3, `A anulação na conta ${o.conta} deixou ${texto}.`)];
  }
  const novoTotal = novos.reduce((s, e) => s + r.meses.reduce((v, mes) => v + parcela(e, mes), 0), 0);
  const valor = (novoTotal - centimos(o.amount)) / 100;
  return [criar(o, c, "anulado_reemitido", Math.abs(valor) > 1 ? 2 : 1,
    `O recibo anulado da conta ${o.conta} tem substituto para todos os meses do período.`, { valor })];
}
function sinalDeValor(r: Indexada, c: ContratoDoControlo | undefined,
  totais: Map<string, number>, hoje: string): Sinal[] {
  if (!c || r.meses.length !== 1) return [];
  const mes = r.meses[0], renda = centimos(rentInMonth(c, c.atualizacoes, mes, hoje).rent);
  if (Math.abs((totais.get(mes) ?? 0) - renda) <= 100) return [];
  const diferenca = centimos(r.obs.amount) - renda;
  if (Math.abs(diferenca) <= 100) return [];
  return [criar(r.obs, c, "valor_diferente", 2,
    `O valor do recibo da conta ${r.obs.conta} difere da renda em vigor em ${monthLabel(mes)}.`,
    { valor: diferenca / 100 })];
}

function sinaisDaJanela(emitidos: Indexada[], c: ContratoDoControlo | undefined, hoje: string): Sinal[] {
  const fim = toMonthKey(hoje), inicio = addMonthsKey(fim, -11);
  const recentes = emitidos.filter((r) => r.meses.some((m) => m >= inicio && m <= fim));
  if (!recentes.length) return [];
  const saida: Sinal[] = [], o = recentes[0].obs;
  const ultima = [...recentes].sort((a, b) =>
    diaDaObservacao(b.obs).localeCompare(diaDaObservacao(a.obs)))[0].obs;
  if (recentes.some((r) => r.obs.withholding > 0) && recentes.some((r) => r.obs.withholding === 0)) {
    saida.push(criar(o, c, "retencao_inconsistente", 2,
      `A conta ${ultima.conta} tem recibos com e sem retenção no mesmo contrato nos últimos 12 meses${c?.empresa ? ", apesar de se esperar retenção" : ""}.`,
      { dia: diaDaObservacao(ultima) }));
  }
  const meses = [...new Set(recentes.flatMap((r) => r.meses))]
    .filter((m) => m >= inicio && m <= fim).sort();
  const cobertos = new Set(meses);
  for (let mes = addMonthsKey(meses[0], 1); mes < meses[meses.length - 1]; mes = addMonthsKey(mes, 1)) {
    if (!cobertos.has(mes)) saida.push({ ...criar(ultima, c, "mes_saltado", 2,
      `A conta ${ultima.conta} não tem recibo emitido para ${monthLabel(mes)} entre dois meses com recibo.`),
      id: `mes_saltado:${o.contrato}:${mes}`, dia: mes });
  }
  return saida;
}
function sinalDeContacto(c: ContratoDoControlo, recibos: Indexada[], ctx: ContextoDoControlo): Sinal[] {
  const meses = ctx.mesesEmAtrasoPorContrato.get(c.id) ?? 0;
  const contacto = ctx.ultimoContactoPorContrato.get(c.id);
  const diasSemContacto = contacto ? diasEntre(contacto, ctx.hoje) : Infinity;
  if (meses < 2 || (diasSemContacto >= 0 && diasSemContacto <= 30)) return [];
  const ultima = [...recibos].sort((a, b) =>
    diaDaObservacao(b.obs).localeCompare(diaDaObservacao(a.obs)))[0]?.obs;
  return [{ id: `atraso_sem_contacto:${c.pf_contract_no}:${toMonthKey(ctx.hoje)}`,
    tipo: "atraso_sem_contacto", gravidade: meses >= 4 ? 3 : 2,
    contrato: c.pf_contract_no ?? "", inquilino: nomeProprio(c.tenant_name), conta: ultima?.conta ?? "",
    dia: ctx.hoje, texto: `O contrato tem ${meses} meses em atraso sem contacto registado nos últimos 30 dias.` }];
}

export function sinais(obs: Observacao[], ctx: ContextoDoControlo): Sinal[] {
  const contratos = new Map(ctx.contratos.filter((c) => c.pf_contract_no).map((c) => [c.pf_contract_no, c]));
  const porContrato = new Map<string, Indexada[]>();
  const saida: Sinal[] = [];
  for (const r of indexar(obs)) {
    const lista = porContrato.get(r.obs.contrato) ?? [];
    lista.push(r);
    porContrato.set(r.obs.contrato, lista);
    saida.push(...sinaisDeDatas(r, contratos.get(r.obs.contrato), ctx.hoje));
  }
  for (const [numero, recibos] of porContrato) {
    const c = contratos.get(numero);
    const anulados = recibos.filter((r) => r.obs.state === "anulado");
    const chavesAnuladas = new Set(anulados.map((r) => r.obs.receiptKey));
    const emitidos = recibos.filter((r) => r.obs.state === "emitido" && !chavesAnuladas.has(r.obs.receiptKey));
    const totais = totaisMensais(emitidos);
    saida.push(...sinaisDeLotes(recibos, c), ...sinaisDaJanela(emitidos, c, ctx.hoje));
    for (const r of anulados) saida.push(...sinalDeAnulacao(r, emitidos, c));
    for (const r of emitidos) saida.push(...sinalDeValor(r, c, totais, ctx.hoje));
  }
  for (const c of ctx.contratos) {
    if (c.pf_contract_no) saida.push(...sinalDeContacto(c, porContrato.get(c.pf_contract_no) ?? [], ctx));
  }
  return [...new Map(saida.map((s) => [s.id, s])).values()].sort((a, b) =>
    b.gravidade - a.gravidade || b.dia.localeCompare(a.dia) || a.id.localeCompare(b.id));
}

function mediana(valores: number[]): number {
  if (!valores.length) return 0;
  const v = [...valores].sort((a, b) => a - b), meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}
export function atrasoDeEmissao(obs: Observacao[]): {
  porConta: Map<string, { mediana: number; n: number; semMedicao: number }>;
  porContrato: Map<string, { mediana: number; n: number }>;
} {
  const contas = new Map<string, { valores: number[]; semMedicao: number }>();
  const contratos = new Map<string, number[]>();
  for (const { obs: o } of indexar(obs)) {
    if (o.state !== "emitido") continue;
    const conta = contas.get(o.conta) ?? { valores: [], semMedicao: 0 };
    const contrato = contratos.get(o.contrato) ?? [];
    const dias = o.firstSeen && o.receivedDate ? diasEntre(o.receivedDate, o.firstSeen) : NaN;
    if (Number.isFinite(dias)) {
      conta.valores.push(Math.max(0, dias));
      contrato.push(Math.max(0, dias));
    } else conta.semMedicao++;
    contas.set(o.conta, conta);
    contratos.set(o.contrato, contrato);
  }
  return {
    porConta: new Map([...contas].map(([chave, { valores, semMedicao }]) =>
      [chave, { mediana: mediana(valores), n: valores.length, semMedicao }])),
    porContrato: new Map([...contratos].map(([chave, valores]) =>
      [chave, { mediana: mediana(valores), n: valores.length }])),
  };
}
export function resumoDoControlo(s: Sinal[]): Record<TipoDeSinal, number> {
  const resumo = Object.fromEntries(TIPOS.map((tipo) => [tipo, 0])) as Record<TipoDeSinal, number>;
  for (const sinal of s) resumo[sinal.tipo]++;
  return resumo;
}
