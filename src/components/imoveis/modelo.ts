import { contractActiveInMonth } from "@/lib/calc";
import { estadoDoMes } from "@/lib/monthcell";
import { resumirPredios } from "@/lib/portfolio/imoveis";
import { problemasPorPredio, type EntradaDeProblemas } from "@/lib/portfolio/problemas";
import type { Ativo, Snapshot } from "@/lib/portfolio/snapshot";

export function prediosComProblemas(entrada: EntradaDeProblemas) {
  const problemas = problemasPorPredio(entrada);
  return resumirPredios(entrada.snap).map((p) => ({ ...p, problemas: problemas.get(p.chave) ?? [],
    comProblemas: (problemas.get(p.chave) ?? []).some((x) => x.gravidade >= 2) }))
    .sort((a, b) => (b.comProblemas ? b.problemas[0].gravidade : 0) - (a.comProblemas ? a.problemas[0].gravidade : 0)
      || (b.comProblemas ? b.problemas[0].valor ?? 0 : 0) - (a.comProblemas ? a.problemas[0].valor ?? 0 : 0)
      || a.nome.localeCompare(b.nome, "pt", { numeric: true }));
}

export function tiraDaFracao(a: Ativo, snap: Snapshot) {
  const c = a.activeContract;
  const fonte = c && snap.fontes.find((f) => f.landlord.id === snap.fonteDoContrato[c.id]);
  const horizonte = fonte?.horizonte && snap.horizon
    ? [fonte.horizonte, snap.horizon].sort()[0] : snap.horizon;
  const corrente = `${snap.hoje.slice(0, 7)}-01`;
  return snap.meses.slice(-12).map((chave) => {
    const celula = a.faixa.find((m) => m.month === chave);
    const paid = celula?.paid ?? snap.pagamentosRecentes
      .filter((p) => p.contract_id === c?.id && p.ref_month === chave)
      .reduce((s, p) => s + p.amount, 0);
    return { chave, estado: estadoDoMes({
      paid, expected: celula?.expected ?? (c ? snap.expectedByContract[c.id] ?? c.rent : 0),
      activeInMonth: !!c && contractActiveInMonth(c, chave),
      vencido: chave < corrente, conhecido: !!horizonte && chave <= horizonte,
    }) };
  });
}
