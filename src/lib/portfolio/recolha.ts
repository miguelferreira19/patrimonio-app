export type CorridaDaRecolha = {
  account: string;
  finished_at: string | null;
  started_at: string;
  ok: boolean;
};

type EstadoDaRecolha = { dias: number | null; tom: "tinta" | "perda"; texto: string };
const diaEmLisboa = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
});

export function estadoDaRecolha(corridas: CorridaDaRecolha[], hoje: string): EstadoDaRecolha {
  if (corridas.length === 0) {
    return { dias: null, tom: "tinta", texto: "Leitura de recibos por configurar" };
  }
  const porConta = new Map<string, CorridaDaRecolha>();
  for (const corrida of corridas) {
    const anterior = porConta.get(corrida.account);
    if (!anterior || Date.parse(corrida.started_at) > Date.parse(anterior.started_at)) {
      porConta.set(corrida.account, corrida);
    }
  }
  const ultimas = [...porConta.values()];
  const sucessos = ultimas.filter((c) => c.ok).map((c) =>
    diaEmLisboa.format(new Date(c.finished_at ?? c.started_at)));
  const dias = sucessos.length === 0 ? null : Math.max(0, ...sucessos.map((dia) =>
    Math.round((Date.parse(hoje) - Date.parse(dia)) / 86_400_000)));
  if (ultimas.some((c) => !c.ok)) return { dias, tom: "perda", texto: "Leitura de recibos falhou" };
  const texto = dias === 0 ? "Recibos lidos hoje" : dias === 1 ? "Recibos lidos ontem" : `Recibos lidos há ${dias} dias`;
  return { dias, tom: dias !== null && dias > 6 ? "perda" : "tinta", texto };
}
