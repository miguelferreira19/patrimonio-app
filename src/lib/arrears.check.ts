// Self-check da metodologia de Atrasos. Correr com `npm run check:arrears`.
// Não é uma suite: são os casos reais que produziam falsos positivos na produção
// (Vitest completo continua a ser o P2-4 do PLANO.md). Cada assert falha se a regra
// da renda de referência se perder num refactor futuro.
import assert from "node:assert/strict";
import { computeArrears, computeArrearsRow, referenceRent, type ArrearsPaymentInput } from "./arrears";
import { addMonthsKey } from "./format";
import { paginateAll } from "./paginate";

const LAST_DUE = "2026-07-01";
const TODAY = new Date(2026, 6, 20); // 20 jul 2026 (mês 6 = julho, 0-indexed)

/** n pagamentos de `amount`, terminando em `endMonth` (inclusive). */
function monthly(amount: number, endMonth: string, n: number): ArrearsPaymentInput[] {
  return Array.from({ length: n }, (_, i) => ({
    contract_id: "c",
    ref_month: addMonthsKey(endMonth, -(n - 1 - i)),
    amount,
  }));
}

function row(rent: number, start: string, payments: ArrearsPaymentInput[]) {
  return computeArrearsRow(
    { id: "c", rent, start_date: start, property_id: "p", tenant_name: "t", pf_contract_no: null },
    payments,
    LAST_DUE,
  );
}

// A) Retenção na fonte de 25%: recibo de 600 €, pagamento de 450 €, todos os meses.
// Antes: nenhum mês atingia 600 → 12 meses de atraso e 7200 € num inquilino em dia.
{
  const r = row(600, "2025-08-01", monthly(450, LAST_DUE, 12));
  assert.equal(r.expectedRent, 450);
  assert.equal(r.streak, 0, "inquilino com retenção na fonte está em dia");
  assert.equal(r.debt, 0);
}

// B) RCFDT ao nível do contrato (lastDue=julho explícito): a renda de referência (290) faz os
// meses a 290 contarem como pagos, matando o 24 × 296 = 7104 €. Sobra o gap fev–jul (6 meses),
// que o horizonte de dados resolve em B2. Antes: nenhum mês atingia 296 → 7104 € fantasma.
{
  const r = row(296, "2015-02-01", [
    ...monthly(284, "2025-01-01", 6),
    ...monthly(290, "2026-01-01", 12),
  ]);
  assert.equal(r.expectedRent, 290);
  assert.equal(r.lastPaidMonth, "2026-01-01");
  assert.equal(r.streak, 6, "sem horizonte (lastDue=julho) sobram 6 meses; ver B2");
  assert.equal(r.debt, 6 * 290);
  assert.notEqual(r.debt, 24 * 296);
}

// B2) RCFDT ao nível da CARTEIRA: o horizonte de dados (último mês importado = 2026-01) trava
// o último mês devido. computeArrears não pode cobrar fev–jul 2026 (ainda não importados).
{
  const rcfdt = {
    id: "rcfdt", rent: 296, start_date: "2015-02-01",
    property_id: "p1", tenant_name: "RCFDT", pf_contract_no: "68686",
  };
  const other = {
    id: "other", rent: 300, start_date: "2020-01-01",
    property_id: "p2", tenant_name: "Outro", pf_contract_no: "999",
  };
  const pays: ArrearsPaymentInput[] = [
    ...monthly(290, "2026-01-01", 24).map((p) => ({ ...p, contract_id: "rcfdt" })),
    ...monthly(300, "2026-01-01", 24).map((p) => ({ ...p, contract_id: "other" })),
  ];
  const { rows, summary } = computeArrears([rcfdt, other], pays, TODAY);
  const rc = rows.find((r) => r.contractId === "rcfdt")!;
  assert.equal(rc.streak, 0, "toda a dívida do RCFDT é falsa: são meses não importados");
  assert.equal(rc.debt, 0);
  assert.equal(summary.contractsInArrears, 0);
}

// B3) Mas um inquilino que REALMENTE parou (enquanto a carteira continua) continua apanhado:
// o horizonte é empurrado pelos outros contratos e o último mês pago dele fica atrás.
{
  const stopped = {
    id: "stop", rent: 300, start_date: "2020-01-01",
    property_id: "p3", tenant_name: "Parou", pf_contract_no: "111",
  };
  const paying = {
    id: "pay", rent: 300, start_date: "2020-01-01",
    property_id: "p4", tenant_name: "Paga", pf_contract_no: "222",
  };
  const pays: ArrearsPaymentInput[] = [
    ...monthly(300, "2026-01-01", 12).map((p) => ({ ...p, contract_id: "stop" })), // parou em jan
    ...monthly(300, "2026-06-01", 12).map((p) => ({ ...p, contract_id: "pay" })),  // continua a jun
  ];
  const { rows } = computeArrears([stopped, paying], pays, TODAY);
  const st = rows.find((r) => r.contractId === "stop")!;
  assert.equal(st.streak, 5, "horizonte = jun (dado pelo outro); parou em jan → 5 meses");
}

// C) Mês parcial não conta duas vezes: o streak já o conta como mês inteiro em falta,
// somar-lhe também o défice dava 3 × 300 + 150.
{
  const r = row(300, "2025-05-01", [
    ...monthly(300, "2026-02-01", 10),
    { contract_id: "c", ref_month: "2026-03-01", amount: 150 },
  ]);
  assert.equal(r.expectedRent, 300);
  assert.equal(r.streak, 5);
  assert.equal(r.debt, 5 * 300, "sem o défice do mês parcial somado por cima");
}

// D) Contrato-zombie (inquilino saiu em 2021, status continua "ativo"): é assinalado,
// mas não inventa 24 meses de renda a somar aos KPIs.
{
  const r = row(200, "2015-11-01", monthly(200, "2021-10-01", 12));
  assert.equal(r.stale, true);
  assert.equal(r.streak, 57);
  assert.equal(r.debt, 0);
}

// E) A referência nunca sobe acima da renda contratada — recibos agrupados (2 meses num
// só ref_month) não podem tornar a régua mais exigente do que o contrato.
{
  const sums = new Map([["2026-06-01", 656], ["2026-07-01", 656]]);
  assert.equal(referenceRent(sums, 328, LAST_DUE), 328);
}

// F) Sem qualquer pagamento não há nada para calibrar: cai na renda do contrato.
{
  const r = row(400, "2026-04-01", []);
  assert.equal(r.expectedRent, 400);
  assert.equal(r.semHistorico, true);
}

// G/H) paginateAll — a leitura completa dos pagamentos que corrige os "nunca". O bug real era o
// Supabase cortar a resposta a ~1000 linhas: contratos além dessa linha ficavam sem pagamentos.
void (async () => {
  // G) 2500 linhas em páginas de 1000: junta tudo, sem perder nem repetir, para na última.
  const src = Array.from({ length: 2500 }, (_, i) => i);
  const got = await paginateAll((from, to) => Promise.resolve(src.slice(from, to + 1)), 1000);
  assert.equal(got.length, 2500, "não pode perder linhas (era isto que fazia o RCFDT ir a nunca)");
  assert.equal(got[0], 0);
  assert.equal(got[2499], 2499);

  // H) total múltiplo exato de pageSize: precisa de mais uma página (vazia) para saber que acabou.
  const exact = Array.from({ length: 2000 }, (_, i) => i);
  let calls = 0;
  const got2 = await paginateAll(
    (from, to) => {
      calls += 1;
      return Promise.resolve(exact.slice(from, to + 1));
    },
    1000,
  );
  assert.equal(got2.length, 2000);
  assert.equal(calls, 3, "2 páginas cheias + 1 vazia");

  console.log("arrears: casos OK (A, B, B2, B3, C, D, E, F, G, H)");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
