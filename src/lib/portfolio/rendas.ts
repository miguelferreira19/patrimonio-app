import { toMonthKey } from "../arrears";
import { contractActiveInMonth } from "../calc";
import { addMonthsKey, lastMonthsKeys, nomeProprio } from "../format";
import { estadoDoMes, monthCellStatus, type EstadoMes, type MonthCellData } from "../monthcell";
import { promessasPorCumprir, type EventoDoDiario } from "./diario";
import { chaveDoInquilino, devedores, type Devedor } from "./inquilinos";
import { fontesParadas } from "./insights";
import { resumoDoSnapshot } from "./mes";
import { nomeDaFracao } from "./predios";
import type { Ativo, Snapshot } from "./snapshot";

export type EstadoRenda = "em_atraso" | "por_receber" | "paga" | "sem_informacao";
export type LinhaDeRenda = {
  chave: string; nome: string; fracoes: string[]; estado: EstadoRenda;
  valorEmAtraso: number; mesesEmAtraso: number; desde: string | null;
  rendaMensal: number; tira: Array<{ chave: string; estado: EstadoMes }>;
  aVigiar: string[];
};

const ORDEM_ESTADO: Record<EstadoRenda, number> = {
  em_atraso: 0, por_receber: 1, sem_informacao: 2, paga: 3,
};
const PIOR_MES: EstadoMes[] = ["atraso", "sem_info", "por_receber", "pago", "fora"];
type Contexto = ReturnType<typeof contexto>;

function contexto(snap: Snapshot) {
  const atual = toMonthKey(snap.hoje);
  const pagos = new Map<string, Map<string, number>>();
  for (const p of snap.pagamentosRecentes) {
    const meses = pagos.get(p.contract_id) ?? new Map<string, number>();
    const mes = toMonthKey(p.ref_month);
    meses.set(mes, (meses.get(mes) ?? 0) + p.amount);
    pagos.set(p.contract_id, meses);
  }
  return {
    atual, pagos,
    meses: lastMonthsKeys(12, atual),
    fechados: lastMonthsKeys(6, addMonthsKey(atual, -1)),
    faixas: new Map(snap.correntes.flatMap((a) => a.activeContract
      ? [[a.activeContract.id, new Map(a.faixa.map((m) => [m.month, m]))] as const] : [])),
    fontes: new Map(snap.fontes.map((f) => [f.landlord.id, f])),
    paradas: new Set(fontesParadas(snap).map((f) => f.landlord.id)),
  };
}

function dadosDoMes(a: Ativo, mes: string, snap: Snapshot, ctx: Contexto): MonthCellData {
  const c = a.activeContract!;
  const existente = ctx.faixas.get(c.id)?.get(mes);
  if (existente) return existente;
  const paid = ctx.pagos.get(c.id)?.get(mes) ?? 0;
  const expected = snap.expectedByContract[c.id] ?? c.rent;
  const fonte = ctx.fontes.get(snap.fonteDoContrato[c.id]);
  const horizon = fonte && snap.horizon && fonte.horizonte < snap.horizon ? fonte.horizonte : snap.horizon;
  return { month: mes, paid, expected, status: monthCellStatus({
    month: mes, paid, expected, horizon, activeInMonth: contractActiveInMonth(c, mes),
  }) };
}

function estadoDoContrato(a: Ativo, mes: string, snap: Snapshot, ctx: Contexto): EstadoMes {
  const celula = dadosDoMes(a, mes, snap, ctx);
  const estado = estadoDoMes({
    paid: celula.paid, expected: celula.expected, activeInMonth: celula.status !== "fora",
    vencido: mes < ctx.atual, conhecido: celula.status !== "futuro" && snap.historicoCarregado,
  });
  if (estado === "pago" || estado === "fora") return estado;
  const fonteId = snap.fonteDoContrato[a.activeContract!.id];
  const fonte = ctx.fontes.get(fonteId);
  if (a.arrears?.stale || !snap.historicoCarregado
    || (ctx.paradas.has(fonteId) && fonte && mes > fonte.horizonte)) return "sem_info";
  return estado;
}

function piorEstado(ativos: Ativo[], mes: string, snap: Snapshot, ctx: Contexto): EstadoMes {
  return ativos.map((a) => estadoDoContrato(a, mes, snap, ctx))
    .reduce((pior, estado) => PIOR_MES.indexOf(estado) < PIOR_MES.indexOf(pior) ? estado : pior, "fora");
}

function motivosDeVigilancia(
  ativos: Ativo[], renda: number, snap: Snapshot, ctx: Contexto, promessas: Set<string>,
): string[] {
  const ids = new Set(ativos.map((a) => a.activeContract!.id));
  const tardios = new Set(snap.pagamentosRecentes.filter((p) => {
    const mes = toMonthKey(p.ref_month);
    return ids.has(p.contract_id) && p.amount > 0 && ctx.fechados.includes(mes)
      && p.received_date && p.received_date <= snap.hoje && p.received_date > `${mes.slice(0, 7)}-15`;
  }).map((p) => toMonthKey(p.ref_month)));
  const parcial = ativos.some((a) => ctx.fechados.some((mes) => {
    const celula = dadosDoMes(a, mes, snap, ctx);
    return celula.status !== "fora" && celula.paid > 0 && celula.paid < celula.expected;
  }));
  const peso = snap.totais.rendaContratada > 0 ? renda / snap.totais.rendaContratada : 0;
  return [
    ...(tardios.size >= 3 ? ["paga tarde"] : []),
    ...(parcial ? ["paga em parte"] : []),
    ...(peso > 0.05 ? [`pesa ${Math.round(peso * 100)}% da renda`] : []),
    ...([...ids].some((id) => promessas.has(id)) ? ["promessa por cumprir"] : []),
  ];
}

function linhaDoInquilino(
  chave: string, ativos: Ativo[], devedor: Devedor | undefined,
  snap: Snapshot, ctx: Contexto, promessas: Set<string>,
): LinhaDeRenda {
  const ordenados = [...ativos].sort((a, b) =>
    (b.activeContract!.start_date ?? "").localeCompare(a.activeContract!.start_date ?? ""));
  const mes = piorEstado(ativos, ctx.atual, snap, ctx);
  const estado: EstadoRenda = devedor ? "em_atraso" : mes === "sem_info" || mes === "fora"
    ? "sem_informacao" : mes === "por_receber" ? "por_receber" : "paga";
  const rendaMensal = ativos.reduce((soma, a) => soma + a.activeContract!.rent, 0);
  return {
    chave, nome: nomeProprio(ordenados[0].activeContract!.tenant_name),
    fracoes: [...new Set(ordenados.map((a) => nomeDaFracao(a.property)))], estado,
    valorEmAtraso: devedor?.divida ?? 0,
    mesesEmAtraso: devedor ? Math.max(...devedor.contratos.map((c) => c.meses)) : 0,
    desde: devedor?.desde ?? null, rendaMensal,
    tira: ctx.meses.map((chave) => ({ chave, estado: piorEstado(ativos, chave, snap, ctx) })),
    aVigiar: devedor ? [] : motivosDeVigilancia(ativos, rendaMensal, snap, ctx, promessas),
  };
}

export function linhasDeRendas(snap: Snapshot, diario: EventoDoDiario[]): LinhaDeRenda[] {
  const ctx = contexto(snap);
  const porInquilino = new Map<string, Ativo[]>();
  for (const a of snap.correntes) {
    if (!a.activeContract) continue;
    const chave = chaveDoInquilino(a.activeContract);
    const ativos = porInquilino.get(chave) ?? [];
    ativos.push(a);
    porInquilino.set(chave, ativos);
  }
  const dividas = new Map(devedores(snap).map((d) => [d.chave, d]));
  const promessas = new Set(promessasPorCumprir(diario, snap.hoje).map((e) => e.contratoId));
  return [...porInquilino].map(([chave, ativos]) =>
    linhaDoInquilino(chave, ativos, dividas.get(chave), snap, ctx, promessas))
    .sort((a, b) => ORDEM_ESTADO[a.estado] - ORDEM_ESTADO[b.estado]
      || (a.estado === "em_atraso" ? b.valorEmAtraso - a.valorEmAtraso : 0)
      || a.nome.localeCompare(b.nome, "pt"));
}

export function resumoDoMes(snap: Snapshot): {
  pagas: number; total: number; recebido: number; porReceber: number;
  emAtraso: number; inquilinosEmAtraso: number; semInformacao: number;
} {
  const mes = resumoDoSnapshot(snap);
  return {
    pagas: mes.pagos, total: mes.total, recebido: mes.recebido, porReceber: mes.porReceber,
    emAtraso: mes.atraso.valor, inquilinosEmAtraso: devedores(snap).length,
    semInformacao: mes.porSaber.contratos,
  };
}
