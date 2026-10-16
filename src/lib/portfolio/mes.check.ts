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
  assert.match(r.contexto, /recolha do dia 15/, "antes da recolha do dia 15 não se alarma");
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
}

// C. Tolerância do arrears.ts: 95% da renda conta como pago (retenção, arredondamentos).
{
  const r = resumoDoMes({ hoje: "2026-10-28", contratos: [{ esperado: 400, pago: 380, porSaber: false }], atraso: semAtraso });
  assert.equal(r.pagos, 1);
  assert.equal(r.porReceber, 0);
}

// D. A CASCATA fecha: os baldes somam o total, sempre (AUDITORIA_CLAREZA.md, ponto 3).
{
  const r = resumoDoMes({
    hoje: "2026-10-20",
    contratos: [
      { esperado: 400, pago: 400, porSaber: false }, // pago
      { esperado: 300, pago: 0, porSaber: false }, // por receber
      { esperado: 500, pago: 200, porSaber: false }, // parcial
      { esperado: 350, pago: 0, porSaber: true }, // fonte parada
    ],
    atraso: semAtraso,
    contratadoIliquido: { valor: 1600, contratos: 4 },
  });
  const { baldes, total, contratado } = r.cascata;
  const soma = baldes.reduce((a, b) => a + b.valor, 0);
  assert.equal(total, soma, "o total é a soma dos baldes, por construção");
  assert.equal(baldes.find((b) => b.chave === "recebido")!.valor, 600);
  assert.equal(baldes.find((b) => b.chave === "por_receber")!.valor, 600, "300 + (500-200)");
  assert.equal(baldes.find((b) => b.chave === "sem_informacao")!.valor, 350);
  assert.equal(total, 1550);
  assert.deepEqual(contratado, { iliquido: 1600, contratos: 4 }, "o ilíquido é nota, não balde");
  assert.ok(contratado.iliquido !== total, "bases diferentes: nunca se somam");
}

// E. Uma fonte parada que ainda assim pagou não conta o dinheiro duas vezes.
{
  const r = resumoDoMes({
    hoje: "2026-10-20",
    contratos: [{ esperado: 500, pago: 200, porSaber: true }],
    atraso: semAtraso,
  });
  const { baldes, total } = r.cascata;
  assert.equal(baldes.find((b) => b.chave === "recebido")!.valor, 200);
  assert.equal(baldes.find((b) => b.chave === "sem_informacao")!.valor, 300, "500 − 200, não 500");
  assert.equal(total, 500, "o contrato vale 500 na cascata, não 700");
}

console.log("mes.check.ts: OK (A, B, C, D, E)");
