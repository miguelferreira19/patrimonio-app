import { addMonthsKey } from "@/lib/format";
import type { PrazoDoAno } from "@/lib/portfolio/agenda";
import type { InsightState } from "@/lib/types";

export function separadorFinanceiro(tab?: string): string {
  return ["impostos", "calendario", "poupanca"].includes(tab ?? "") ? tab! : "resultado";
}

export function destinoImpostos(sp: { ano?: string; senhorio?: string }): string {
  const query = new URLSearchParams({ tab: "impostos" });
  if (sp.ano) query.set("ano", sp.ano);
  if (sp.senhorio) query.set("senhorio", sp.senhorio);
  return `/financas?${query}`;
}

export function prazosFeitos(estados: Pick<InsightState, "kind" | "subject" | "dismissed_at">[]): Set<string> {
  return new Set(estados.filter((e) => e.kind === "prazo" && e.dismissed_at).map((e) => e.subject));
}

export function calendarioVisivel(prazos: PrazoDoAno[], hoje: string) {
  const inicio = `${hoje.slice(0, 7)}-01`;
  const meses = Array.from({ length: 12 }, (_, i) => {
    const mes = addMonthsKey(inicio, i);
    return { mes, prazos: prazos.filter((p) => p.dia >= hoje && p.dia.startsWith(mes.slice(0, 7)))
      .sort((a, b) => a.dia.localeCompare(b.dia) || a.id.localeCompare(b.id)) };
  });
  const limite = new Date(`${hoje}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 90);
  const porFazer = meses.flatMap((m) => m.prazos).filter((p) => !p.feito);
  const conhecidos = porFazer.filter((p) => p.dia <= limite.toISOString().slice(0, 10) && p.valor !== null);
  return {
    meses, proximo: porFazer[0] ?? null,
    valor90Dias: conhecidos.reduce((s, p) => s + Math.round(p.valor! * 100), 0) / 100,
    incluiEstimativas: conhecidos.some((p) => p.estimado),
  };
}
