import { nomeProprio } from "@/lib/format";
import { passoDaEscada } from "@/lib/minutas-cobranca";
import { aimiPorSenhorio, prazosDoAno, proximosPrazos, type PrazoDoAno } from "@/lib/portfolio/agenda";
import { cartasDoCiclo } from "@/lib/portfolio/cartas-diario";
import { promessasPorCumprir, type EventoDoDiario } from "@/lib/portfolio/diario";
import { chaveDoInquilino, devedores } from "@/lib/portfolio/inquilinos";
import { construirFila, UNIDADE_LABEL } from "@/lib/portfolio/insights";
import type { RawData } from "@/lib/portfolio/load";
import type { Snapshot } from "@/lib/portfolio/snapshot";

export type TarefaDoInicio = {
  id: string; titulo: string; href: string; dia: string;
  valor?: number | null; estimado?: boolean; unidade?: string;
};
const ficha = (chave: string) => `/inquilinos/${encodeURIComponent(chave)}`;
const CARTA = { lembrete: "lembrete", interpelacao: "interpelação", resolucao: "aviso de resolução" };

function cartasProntas(snap: Snapshot, diario: EventoDoDiario[]): TarefaDoInicio[] {
  return devedores(snap).flatMap((devedor) => {
    for (const c of devedor.contratos) {
      const passo = passoDaEscada({ mesesEmAtraso: c.meses, hoje: snap.hoje,
        cartas: cartasDoCiclo(diario, c.contract.id, c.desde, snap.hoje) });
      if (passo.proxima && passo.quando && passo.quando <= snap.hoje) {
        return [{ id: `carta:${devedor.chave}`, dia: snap.hoje, href: ficha(devedor.chave),
          titulo: `Enviar ${CARTA[passo.proxima]} a ${nomeProprio(devedor.nome)}` }];
      }
    }
    return [];
  });
}

export function prazosDoInicio(snap: Snapshot, raw: RawData): PrazoDoAno[] {
  const ano = Number(snap.hoje.slice(0, 4));
  return proximosPrazos([ano, ano + 1].flatMap((a) => prazosDoAno({
    ano: a, hoje: snap.hoje, despesas: raw.expenses, senhorios: raw.landlords,
    titulares: raw.owners, aimi: aimiPorSenhorio(raw.landlords, raw.owners, raw.properties),
    rendas: [], feitos: new Set(),
  })), snap.hoje, 3);
}

export function tarefasDoInicio(
  snap: Snapshot, diario: EventoDoDiario[], prazos: PrazoDoAno[], isAdmin: boolean,
): TarefaDoInicio[] {
  const contratos = new Map(snap.correntes.flatMap((a) => a.activeContract ? [[a.activeContract.id, a.activeContract] as const] : []));
  const promessas = promessasPorCumprir(diario, snap.hoje)
    .sort((a, b) => a.prometidoPara!.localeCompare(b.prometidoPara!)).flatMap((e) => {
      const c = contratos.get(e.contratoId);
      return c ? [{ id: `promessa:${e.id}`, titulo: `Promessa por cumprir: ${nomeProprio(c.tenant_name)}`,
        href: ficha(chaveDoInquilino(c)), dia: e.prometidoPara!, valor: e.valor }] : [];
    });
  const calendario = proximosPrazos(prazos, snap.hoje, 3).map((p) => ({
    id: p.id, titulo: p.senhorio ? p.titulo.replace(p.senhorio, nomeProprio(p.senhorio)) : p.titulo,
    href: "/financas?tab=calendario", dia: p.dia, valor: p.valor, estimado: p.estimado,
  }));
  const fila = isAdmin ? construirFila(snap).itens.filter((i) => i.grupo !== "poupar" && i.kind !== "atraso")
    .map((i) => ({ id: `${i.kind}:${i.subject ?? ""}`, titulo: i.titulo,
      href: i.acoes[0]?.href ?? "/tarefas", dia: snap.hoje,
      valor: i.unidade === "sem_valor" ? null : i.euros, unidade: UNIDADE_LABEL[i.unidade],
      estimado: i.confianca !== "medido" })) : [];
  return [...cartasProntas(snap, diario), ...promessas, ...calendario, ...fila].slice(0, 5);
}
