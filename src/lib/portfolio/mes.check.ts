// Self-check de mes.ts. Corre com `npm run check`.
import assert from "node:assert/strict";
import { resumoDoMes } from "./mes";

const semAtraso = { valor: 0, contratos: 0 };

// A. Dia 9: o que falta é "por receber", nunca atraso, e o contexto diz porquê.
{
  const r = resumoDoMes({
    hoje: "2026-10-09",
    contratos: [
      { esperado: 450, pago: 450, porSaber: false },
      { esperado: 300, pago: 0, porSaber: false },
      { esperado: 500, pago: 200, porSaber: false },
    ],
    atraso: { valor: 1925, contratos: 11 },
  });
  assert.equal(r.esperado, 1250);
  assert.equal(r.recebido, 650);
  assert.equal(r.porReceber, 600);
  assert.equal(r.pagos, 1);
  assert.equal(r.total, 3);
  assert.equal(r.titulo, "Faltam 2 rendas de outubro.");
  assert.match(r.contexto, /recolha do dia 15/);
  assert.deepEqual(r.atraso, { valor: 1925, contratos: 11 }, "o atraso é o dos meses anteriores, passado tal e qual");
}

// B. Uma fonte parada fica fora do esperado e conta à parte.
{
  const r = resumoDoMes({
    hoje: "2026-10-20",
    contratos: [
      { esperado: 400, pago: 400, porSaber: false },
      { esperado: 350, pago: 0, porSaber: true },
    ],
    atraso: semAtraso,
  });
  assert.equal(r.esperado, 400);
  assert.equal(r.total, 1);
  assert.deepEqual(r.porSaber, { valor: 350, contratos: 1 });
  assert.match(r.titulo, /^Outubro fechado: 1 de 1/);
}

// C. Tolerância do arrears.ts: 95% da renda conta como pago (retenção, arredondamentos).
{
  const r = resumoDoMes({ hoje: "2026-10-28", contratos: [{ esperado: 400, pago: 380, porSaber: false }], atraso: semAtraso });
  assert.equal(r.pagos, 1);
  assert.equal(r.porReceber, 0);
}

console.log("mes.check.ts: OK (A, B, C)");
