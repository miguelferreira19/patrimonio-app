// Self-check de rent.ts. Correr com `npm run check:rent`.
// Os casos A e B são os dois contratos REAIS que estavam errados na carteira em 2026-07-25;
// o C é o falso positivo que 19 contratos produziam e que não pode voltar a aparecer.
import assert from "node:assert/strict";
import { desalinhamentoDaRenda, rendaObservada } from "./rent";

function meses(pares: Array<[string, number]>): Map<string, number> {
  return new Map(pares);
}

// A — 1825765 "Repeses First": renda mensal repartida em 2 recibos (175 + 156 = 331).
// O último mês só tinha a parcela de 175 emitida, e era isso que a renda passava a valer.
{
  const porMes = meses([
    ["2025-06-01", 331], ["2025-07-01", 331], ["2025-08-01", 331], ["2025-09-01", 331],
    ["2025-10-01", 331], ["2025-11-01", 331], ["2025-12-01", 331], ["2026-01-01", 331],
    ["2026-02-01", 331], ["2026-03-01", 331],
    ["2026-04-01", 175], // mês parcial: só uma das duas parcelas
  ]);
  const obs = rendaObservada(porMes);
  assert.equal(obs?.valor, 331, "a renda é o total que se repete, não o do último mês");
  assert.equal(obs?.vezes, 10);
  const d = desalinhamentoDaRenda(175, obs);
  assert.equal(d?.direcao, "baixa", "175 está BAIXA face aos 331 dos recibos");
  assert.equal(d?.diferenca, 156, "faltam 156 EUR/mês");
}

// B — 68665 "1PES": mesmo padrão, 290 repetido e último mês a 179.
{
  const porMes = meses([
    ["2025-09-01", 290], ["2025-10-01", 290], ["2025-11-01", 290], ["2025-12-01", 290],
    ["2026-01-01", 290], ["2026-02-01", 179],
  ]);
  assert.equal(rendaObservada(porMes)?.valor, 290);
  assert.equal(desalinhamentoDaRenda(179, rendaObservada(porMes))?.direcao, "baixa");
}

// C — atualização anual pelo coeficiente (~2%): NÃO é desalinhamento. Eram 19 dos 21
// "suspeitos" na carteira real, e tratá-los como erro tornaria o alerta inútil.
{
  const porMes = meses([
    ["2025-08-01", 311], ["2025-09-01", 311], ["2025-10-01", 311], ["2025-11-01", 311],
    ["2025-12-01", 311], ["2026-01-01", 317], ["2026-02-01", 317],
  ]);
  const obs = rendaObservada(porMes);
  // Entre valores que se repetem ganha o MAIS RECENTE (mesma regra do caso D), por isso a
  // renda observada acompanha a atualização em vez de ficar presa na antiga.
  assert.equal(obs?.valor, 317, "317 já se repete e é o mais recente");
  assert.equal(desalinhamentoDaRenda(317, obs), null, "renda alinhada: nenhum alerta");
  // E mesmo que a renda registada fosse ainda a antiga, 2% não chega para alertar.
  assert.equal(
    desalinhamentoDaRenda(311, { valor: 317, vezes: 5 }),
    null,
    "2% é o coeficiente anual, não um erro",
  );
}

// D — uma atualização já consolidada passa a ser a renda observada: entre valores que se
// repetem, ganha o mais RECENTE (senão a app ficava presa na renda antiga para sempre).
{
  const porMes = meses([
    ["2025-06-01", 300], ["2025-07-01", 300], ["2025-08-01", 300],
    ["2025-09-01", 350], ["2025-10-01", 350],
  ]);
  assert.equal(rendaObservada(porMes)?.valor, 350, "350 repete-se e é mais recente");
}

// E — sem repetições não se afirma nada: uma renda com um mês só de histórico não pode
// disparar um alerta de desalinhamento.
{
  const obs = rendaObservada(meses([["2026-04-01", 175]]));
  assert.equal(obs?.valor, 175);
  assert.equal(obs?.vezes, 1);
  assert.equal(desalinhamentoDaRenda(331, obs), null, "vezes < 3 não gera alerta");
}

// F — casos de fronteira.
{
  assert.equal(rendaObservada(new Map()), null);
  assert.equal(rendaObservada(meses([["2026-01-01", 0]])), null, "mês a zero não conta");
  assert.equal(rendaObservada(meses([["2026-01-01", 0.4]])), null, "cêntimos são ruído");
  assert.equal(desalinhamentoDaRenda(0, { valor: 300, vezes: 5 }), null, "renda 0 não compara");
  // Renda ALTA face aos recibos: é o caso da retenção na fonte se alguém comparar com
  // valores líquidos por erro, e também de uma renda inflacionada. A direção é reportada.
  assert.equal(desalinhamentoDaRenda(400, { valor: 300, vezes: 5 })?.direcao, "alta");
}

console.log("rent.check.ts: OK (A, B, C, D, E, F)");
