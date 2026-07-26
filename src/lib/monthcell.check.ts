// Self-check de monthcell.ts. Correr com `npm run check:monthcell`.
// Sem framework: assert puro sobre o código real, como os outros checks do projeto.
import assert from "node:assert/strict";
import {
  fillFraction,
  monthCellStatus,
  monthCellTitle,
  type MonthCellData,
} from "./monthcell";

const HORIZON = "2026-06-01";

function status(over: Partial<Parameters<typeof monthCellStatus>[0]> = {}) {
  return monthCellStatus({
    month: "2026-05-01",
    paid: 0,
    expected: 400,
    activeInMonth: true,
    horizon: HORIZON,
    ...over,
  });
}

// A — o bug B2 em forma de teste: um mês DEPOIS da fronteira de dados nunca é "falta".
// Era exatamente isto que a grelha de Pagamentos fazia (qualquer mês passado sem
// pagamento = falta), enquanto os Atrasos já travavam no horizonte. Resultado: o mesmo
// mês vermelho numa página e verde na outra.
{
  assert.equal(status({ month: "2026-07-01", paid: 0 }), "futuro", "julho > horizonte junho");
  assert.equal(status({ month: "2026-06-01", paid: 0 }), "falta", "o próprio mês do horizonte é devido");
  assert.equal(status({ month: "2026-05-01", paid: 0 }), "falta");
}

// B — sem nenhum recibo na carteira a app não afirma nada sobre nenhum mês.
{
  assert.equal(status({ horizon: null, paid: 0 }), "futuro");
  assert.equal(status({ horizon: null, paid: 400 }), "futuro", "nem mesmo com pagamento");
}

// C — tolerância de 90% (PAID_TOLERANCE de arrears.ts, não reimplementada aqui).
// 360 = 90% de 400 conta como pago; 359 já é parcial.
{
  assert.equal(status({ paid: 400 }), "pago");
  assert.equal(status({ paid: 360 }), "pago", "exatamente 90%");
  assert.equal(status({ paid: 359 }), "parcial");
  assert.equal(status({ paid: 0.5 }), "falta", "abaixo de EPSILON_EUR é ruído de cêntimos");
  assert.equal(status({ paid: 1 }), "parcial", "1 EUR já é um pagamento parcial");
}

// D — "fora do contrato" tem prioridade sobre tudo, mesmo com pagamento no mês.
// Mesma prioridade de computeArrearsRow: um pagamento fora do período é um dado
// estranho, não transforma o mês em devido.
{
  assert.equal(status({ activeInMonth: false, paid: 400 }), "fora");
  assert.equal(status({ activeInMonth: false, paid: 0, month: "2026-07-01" }), "fora");
}

// E — fillFraction: é a ALTURA da barra, logo tem de estar sempre em [0,1] e nunca
// inventar altura para estados sem dado.
{
  const cell = (over: Partial<MonthCellData>): MonthCellData => ({
    month: "2026-05-01",
    status: "parcial",
    paid: 200,
    expected: 400,
    ...over,
  });
  assert.equal(fillFraction(cell({})), 0.5);
  assert.equal(fillFraction(cell({ status: "pago", paid: 400 })), 1);
  assert.equal(fillFraction(cell({ status: "pago", paid: 999 })), 1, "pago é sempre cheio");
  assert.equal(fillFraction(cell({ status: "falta", paid: 0 })), 0);
  assert.equal(fillFraction(cell({ status: "fora", paid: 400 })), 0, "sem contrato não desenha");
  assert.equal(fillFraction(cell({ status: "futuro", paid: 400 })), 0, "por importar não desenha");
  assert.equal(fillFraction(cell({ expected: 0 })), 0, "sem base de comparação, sem barra");
  assert.equal(fillFraction(cell({ paid: 900 })), 1, "clampado a 1");
  assert.equal(fillFraction(cell({ paid: -50 })), 0, "clampado a 0");
}

// F — os títulos distinguem "não pagou" de "não sei": é a diferença que a V1 apagava.
{
  const base: MonthCellData = { month: "2026-05-01", status: "falta", paid: 0, expected: 400 };
  assert.ok(monthCellTitle(base).includes("em falta"));
  assert.ok(
    monthCellTitle({ ...base, status: "futuro" }).includes("não importado"),
    "o estado futuro tem de dizer que a app não sabe, não que faltou",
  );
  assert.ok(monthCellTitle({ ...base, status: "parcial", paid: 100 }).includes("faltam"));
  assert.ok(monthCellTitle({ ...base, status: "fora" }).includes("fora do período"));
}

console.log("monthcell.check.ts: OK (A, B, C, D, E, F)");
