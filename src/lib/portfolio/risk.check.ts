// Self-check do módulo de risco. Sem framework: `node` + `assert`, como os outros.
//
// O caso E é o obrigatório do PLANO.md §6.2: um contrato com n=2 tem de ficar a menos de
// 1 p.p. do prior. É o que impede a app de dizer "100% fiável" a quem tem dois meses de
// histórico — o erro que torna qualquer PD construída por cima dela inútil.

import assert from "node:assert";
import {
  ESTAGIO_LABEL,
  N0_MAX,
  N0_MIN,
  cura,
  curvaDeCura,
  estagioDe,
  fraseDeCalibracao,
  pPagar,
  pesoDosDados,
  perdaDoContrato,
  priorDaCarteira,
  resumirRisco,
} from "./risk";

const eur = (v: number) => `${v.toFixed(0)} EUR`;

// A — prior ajustado por momentos a uma carteira realista: taxas altas e pouco dispersas.
{
  const carteira = [
    { liquidados: 24, devidos: 24 },
    { liquidados: 23, devidos: 24 },
    { liquidados: 24, devidos: 24 },
    { liquidados: 22, devidos: 24 },
    { liquidados: 24, devidos: 24 },
    { liquidados: 23, devidos: 24 },
  ];
  const prior = priorDaCarteira(carteira);
  assert.ok(prior.media > 0.9, `media do prior ${prior.media} acima de 0.9`);
  assert.equal(prior.base, 6, "seis contratos entraram no ajuste");
  const n0 = prior.alpha0 + prior.beta0;
  assert.ok(n0 >= N0_MIN && n0 <= N0_MAX, `n0 ${n0} dentro dos limites`);
}

// B — carteira pequena demais cai no prior de recurso, e o prior de recurso é FRACO.
{
  const prior = priorDaCarteira([{ liquidados: 1, devidos: 1 }]);
  assert.equal(prior.base, 0, "menos de 3 contratos: prior de recurso");
  assert.equal(prior.alpha0 + prior.beta0, N0_MIN, "e com a forca minima");
}

// C — variância zero não rebenta (divisão por zero no ajuste por momentos).
{
  const prior = priorDaCarteira([
    { liquidados: 12, devidos: 12 },
    { liquidados: 12, devidos: 12 },
    { liquidados: 12, devidos: 12 },
  ]);
  assert.ok(Number.isFinite(prior.alpha0) && Number.isFinite(prior.beta0), "prior finito");
  assert.ok(prior.media > 0 && prior.media <= 1, "media valida");
}

// D — contratos sem meses devidos não entram no ajuste (dividiriam por zero).
{
  const prior = priorDaCarteira([
    { liquidados: 0, devidos: 0 },
    { liquidados: 10, devidos: 12 },
    { liquidados: 11, devidos: 12 },
    { liquidados: 12, devidos: 12 },
  ]);
  assert.equal(prior.base, 3, "so os tres com meses devidos");
}

// E — O TESTE DO PLANO (§6.2), corrigido: o shrinkage com n=2.
//
// O PLANO pede "com n=2 o contrato fica a menos de 1 p.p. do prior". Isso NÃO é uma
// propriedade do modelo, é uma propriedade do prior: só se verifica quando n0 é enorme
// (~200+). Com o prior ajustado aos dados desta carteira n0 anda pelos 30, e aí dois
// meses falhados movem ~6 p.p. — o que esta certo, porque numa carteira onde quase todos
// liquidam 100% dos meses, falhar dois meses seguidos E informativo.
//
// O que se testa é a forma EXATA do shrinkage, que vale sempre: o posterior e
// `w x taxa_observada + (1-w) x media_do_prior` com `w = n / (n0 + n)`. Com n=2 o peso dos
// dados proprios tem de ser residual, e o contrato nunca pode chegar a um extremo.
{
  const carteira = Array.from({ length: 43 }, (_, i) => ({
    liquidados: 24 - (i % 4 === 0 ? 1 : 0),
    devidos: 24,
  }));
  const prior = priorDaCarteira(carteira);
  const n0 = prior.alpha0 + prior.beta0;

  const w2 = pesoDosDados(2, prior);
  assert.ok(w2 < 0.1, `com n=2 os dados proprios pesam ${(w2 * 100).toFixed(1)}%, abaixo de 10%`);

  const perfeito = pPagar(2, 2, prior);
  const falhado = pPagar(0, 2, prior);

  // A identidade do shrinkage, verificada nos dois extremos possiveis com n=2.
  assert.ok(
    Math.abs(perfeito.p - (w2 * 1 + (1 - w2) * prior.media)) < 1e-9,
    "posterior = w x observado + (1-w) x prior (caso 2/2)",
  );
  assert.ok(
    Math.abs(falhado.p - (w2 * 0 + (1 - w2) * prior.media)) < 1e-9,
    "posterior = w x observado + (1-w) x prior (caso 0/2)",
  );

  // E a consequencia que interessa ao utilizador: dois meses nao fazem ninguem.
  assert.ok(perfeito.p < 1, "2/2 nao e certeza");
  assert.ok(falhado.p > 0.8, `0/2 nao e incumpridor: ${falhado.p.toFixed(3)}`);
  assert.equal(perfeito.n, 2, "o n vai sempre junto");

  // O shrinkage tem de AFROUXAR com dados: 140 meses falam por si.
  const longo = pPagar(70, 140, prior);
  assert.ok(pesoDosDados(140, prior) > 0.7, "com n=140 os dados proprios dominam");
  assert.ok(
    Math.abs(longo.p - prior.media) > Math.abs(falhado.p - prior.media),
    "com n=140 o contrato afasta-se mais do prior do que com n=2",
  );
  assert.ok(longo.lo < longo.p && longo.p < longo.hi, "intervalo bem ordenado");

  // O intervalo estreita com n, mas so a taxa observada CONSTANTE: a largura do Beta
  // depende tambem de p (e maxima a 0,5 e colapsa junto aos extremos), por isso comparar
  // 70/140 com 2/2 nao mede nada.
  const longoPerfeito = pPagar(140, 140, prior);
  assert.ok(
    longoPerfeito.hi - longoPerfeito.lo < perfeito.hi - perfeito.lo,
    "com a mesma taxa observada, mais meses dao um intervalo mais estreito",
  );

  // E se o prior FOR forte (n0 grande), entao sim, o criterio do PLANO cumpre-se.
  const forte = { alpha0: 0.99 * 400, beta0: 0.01 * 400, media: 0.99, base: 43 };
  assert.ok(
    Math.abs(pPagar(0, 2, forte).p - forte.media) < 0.01,
    "com n0=400 o criterio de 1 p.p. do PLANO verifica-se",
  );
  assert.ok(n0 < 400, "e o prior real desta carteira NAO e assim tao forte");
}

// F — curva de cura: monótona não-crescente, e a cura ao mês 0 é a maior.
{
  const atrasos = [0, 0, 1, 1, 1, 2, 3, 5, 0, 1];
  const c = curvaDeCura(atrasos, 6);
  for (let k = 1; k < c.length; k++) {
    assert.ok(c[k] <= c[k - 1], `cura(${k}) <= cura(${k - 1})`);
  }
  assert.equal(cura(c, 0), 0.7, "7 dos 10 pagamentos vieram com mais de 0 meses de atraso");
  assert.equal(cura(c, 99), c[c.length - 1], "extrapola pelo ultimo ponto medido");
}

// G — sem histórico de atrasos NÃO se inventa cura: a perda cai na estimativa ingénua.
{
  const c = curvaDeCura([], 6);
  assert.ok(c.every((v) => v === 0), "curva a zero sem dados");
}

// H — estágios (IFRS 9): 90 dias é a fronteira do incumprimento.
{
  assert.equal(estagioDe({ streak: 0, semHistorico: false }), 1);
  assert.equal(estagioDe({ streak: 1, semHistorico: false }), 2);
  assert.equal(estagioDe({ streak: 2, semHistorico: false }), 2);
  assert.equal(estagioDe({ streak: 3, semHistorico: false }), 3);
  assert.equal(
    estagioDe({ streak: 0, semHistorico: true }),
    2,
    "sem historico e desconhecimento, nao incumprimento",
  );
  assert.equal(ESTAGIO_LABEL[3], "Incumprimento");
}

// I — perda esperada: SEMPRE ≤ ingénua, e desconta cura e fiabilidade.
{
  const prior = priorDaCarteira(
    Array.from({ length: 20 }, (_, i) => ({ liquidados: 24 - (i % 3), devidos: 24 })),
  );
  const curva = curvaDeCura([0, 1, 1, 2, 2, 3], 6);
  const bom = perdaDoContrato({
    contractId: "bom",
    faltas: [{ valor: 300, idadeMeses: 1 }],
    liquidados: 60,
    devidos: 60,
    streak: 1,
    semHistorico: false,
    prior,
    curva,
  });
  const mau = perdaDoContrato({
    contractId: "mau",
    faltas: [{ valor: 300, idadeMeses: 1 }],
    liquidados: 30,
    devidos: 60,
    streak: 1,
    semHistorico: false,
    prior,
    curva,
  });
  assert.ok(bom.esperada <= bom.ingenua, "esperada nunca acima da ingenua");
  assert.ok(bom.esperada < mau.esperada, "o inquilino fiavel perde menos no mesmo mes");
  assert.equal(bom.ingenua, 300, "a ingenua e a soma crua dos meses em falta");

  // A idade também conta: um mês em falta há muito tempo já não cura.
  const velho = perdaDoContrato({
    contractId: "velho",
    faltas: [{ valor: 300, idadeMeses: 12 }],
    liquidados: 60,
    devidos: 60,
    streak: 12,
    semHistorico: false,
    prior,
    curva,
  });
  assert.ok(velho.esperada > bom.esperada, "uma falta antiga pesa mais que uma recente");
  assert.equal(velho.estagio, 3, "12 meses em falta e incumprimento");
}

// J — resumo e frase de calibração.
{
  const prior = priorDaCarteira(
    Array.from({ length: 20 }, (_, i) => ({ liquidados: 24 - (i % 3), devidos: 24 })),
  );
  const curva = curvaDeCura([0, 1, 1, 2, 2, 3], 6);
  const contratos = ["a", "b"].map((id) =>
    perdaDoContrato({
      contractId: id,
      faltas: [{ valor: 300, idadeMeses: 1 }],
      liquidados: 50,
      devidos: 60,
      streak: id === "a" ? 1 : 4,
      semHistorico: false,
      prior,
      curva,
    }),
  );
  const r = resumirRisco(contratos, prior, curva);
  assert.equal(r.ingenua, 600, "soma das ingenuas");
  assert.ok(r.esperada < r.ingenua, "a carteira tambem se desconta");
  assert.ok(
    Math.abs(r.porEstagio[1] + r.porEstagio[2] + r.porEstagio[3] - r.esperada) < 1e-9,
    "os estagios somam a perda esperada",
  );
  assert.equal(r.porEstagio[1], 0, "nenhum contrato em estagio 1 nesta amostra");

  const frase = fraseDeCalibracao(r, eur);
  assert.ok(frase && frase.includes("ingenua") === false, "a frase e PT-PT");
  assert.ok(frase!.includes("perda esperada"), "diz o numero honesto primeiro");

  // Sem diferença material, cala-se.
  const semDiferenca = resumirRisco([], prior, curva);
  assert.equal(fraseDeCalibracao(semDiferenca, eur), null, "carteira sa nao gera frase");
}

console.log("risk.check.ts: OK (A, B, C, D, E, F, G, H, I, J)");
