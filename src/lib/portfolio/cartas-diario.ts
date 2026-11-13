import { addMonthsKey } from "../format";
import { isMinutaTipo, type CartaEnviada, type DividaDaCarta } from "../minutas";
import { eData, exigir } from "../validar";
import type { EventoDoDiario } from "./diario";
import type { ContratoEmAtraso } from "./inquilinos";

export function cartasDoDiario(diario: readonly EventoDoDiario[]): CartaEnviada[] {
  return diario.flatMap((evento): CartaEnviada[] => {
    if (evento.tipo !== "carta" || !eData(evento.dia) || !evento.texto.includes(":")) return [];
    const tipo = evento.texto.slice(0, evento.texto.indexOf(":"));
    return isMinutaTipo(tipo) ? [{ tipo, dia: evento.dia }] : [];
  }).sort((a, b) => a.dia.localeCompare(b.dia));
}

export function cartasDoCiclo(
  diario: readonly EventoDoDiario[], contratoId: string, desde: string, hoje: string,
): CartaEnviada[] {
  return cartasDoDiario(diario.filter((e) => e.contratoId === contratoId && e.dia >= desde && e.dia <= hoje));
}

export function dividaDaCarta(atraso: ContratoEmAtraso | undefined): DividaDaCarta {
  if (!atraso || atraso.meses < 1) return { total: 0, meses: [] };
  const total = Math.round(atraso.divida * 100);
  const base = Math.floor(total / atraso.meses);
  // O devedor usa meses inteiros de renda de referência; conserva-se esse total até ao cêntimo.
  return { total: total / 100, meses: Array.from({ length: atraso.meses }, (_, i) => ({
    mes: addMonthsKey(atraso.desde, i),
    valor: (i === atraso.meses - 1 ? total - base * i : base) / 100,
  })) };
}

export function planoDoAcordo(
  query: { prestacoes?: string; primeira?: string }, hoje: string,
): { prestacoes: number; primeira: string } {
  const prestacoes = Number(query.prestacoes ?? 3);
  const primeira = query.primeira ?? hoje;
  exigir(Number.isInteger(prestacoes) && prestacoes >= 1 && prestacoes <= 24,
    "Indica entre 1 e 24 prestações.");
  exigir(eData(primeira), "Indica uma data válida para a primeira prestação.");
  return { prestacoes, primeira };
}
