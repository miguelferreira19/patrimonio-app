import assert from "node:assert/strict";
import {
  monthStatement,
  parseAllocations,
  shareOf,
  scopedExpense,
  quotasDeclarantes,
  receiptCandidates,
  declaredContractDates,
  pagamentosManuais,
  comPagamentosManuais,
} from "./gestao";
import type { Contract, Expense, Landlord, Receipt } from "./types";
import type { PaymentMovement } from "./gestao";

const contract: Contract = {
  id: "c",
  property_id: "p",
  tenant_name: "A",
  tenant_nif: null,
  pf_contract_no: "1",
  start_date: "2026-01-01",
  end_date: null,
  rent: 600,
  due_day: 1,
  status: "ativo",
  notes: null,
};
const receipt: Receipt = {
  id: "r",
  landlord_id: "l",
  property_id: "p",
  contract_id: "c",
  pf_contract_no: "1",
  receipt_number: "1/1",
  ref_month: "2026-10-01",
  period_start: "2026-10-01",
  period_end: "2026-10-31",
  amount: 600,
  withholding: 150,
  issue_date: "2026-10-01",
  source: "portal",
};
const movement: PaymentMovement = {
  id: "m",
  contract_id: "c",
  amount: 450,
  received_date: "2026-10-02",
  method: "transferencia",
  reference: "ABC",
  proof_path: null,
  notes: null,
  voided: false,
  void_reason: null,
  request_id: "q",
  created_at: "",
  created_by: null,
};
const base = {
  contract,
  month: "2026-10-01",
  today: "2026-10-09",
  horizon: "2026-10-01",
  receipts: [receipt],
  updates: [],
  movements: [],
  allocations: [],
  confirmations: [],
};
// Recibo emitido = pago (PLANO_CLAREZA.md §3); antes era "pagamento por confirmar" em todas
// as 42 rendas, porque ninguém regista movimentos à mão.
const documentary = monthStatement(base);
assert.equal(documentary.status, "pago");
assert.equal(documentary.expected, 450);
assert.equal(documentary.documented, 450);
assert.equal(documentary.confirmed, 0);
const confirmed = monthStatement({
  ...base,
  movements: [movement],
  allocations: [{ movement_id: "m", ref_month: "2026-10-01", amount: 450 }],
});
assert.equal(confirmed.status, "pago");
assert.equal(confirmed.recorded, 450); // Não 900: recibo + pagamento não duplicam.
const novembro = { ...base, today: "2026-11-09" };
const partial = monthStatement({
  ...novembro,
  movements: [{ ...movement, amount: 100 }],
  allocations: [{ movement_id: "m", ref_month: "2026-10-01", amount: 100 }],
});
assert.equal(partial.status, "atraso");
assert.equal(partial.recorded, 100);
assert.equal(partial.confirmedBalance, null);
assert.equal(
  monthStatement({
    ...base,
    movements: [{ ...movement, amount: 100 }],
    allocations: [{ movement_id: "m", ref_month: "2026-10-01", amount: 100 }],
  }).status,
  "por_receber",
  "o mês em curso nunca é atraso",
);
const balance = monthStatement({
  ...novembro,
  movements: [{ ...movement, amount: 100 }],
  allocations: [{ movement_id: "m", ref_month: "2026-10-01", amount: 100 }],
  confirmations: [
    {
      contract_id: "c",
      ref_month: "2026-10-01",
      expected_amount: 450,
      note: "Extrato conferido",
      confirmed_at: "2026-10-09",
      confirmed_by: "u",
    },
  ],
});
assert.equal(balance.status, "atraso");
assert.equal(balance.confirmedBalance, 350);
assert.equal(
  monthStatement({ ...novembro, receipts: [], horizon: "2026-07-01" }).status,
  "sem_info",
  "fonte parada: não se sabe",
);
assert.equal(
  monthStatement({ ...novembro, receipts: [], horizon: "2026-10-01" }).status,
  "atraso",
  "fonte ativa e mês fechado sem recibo",
);
assert.equal(monthStatement({ ...base, receipts: [], month: "2026-11-01" }).status, "por_receber");
assert.equal(
  monthStatement({ ...base, contract: { ...contract, status: "cessado", end_date: "2026-09-30" } }).status,
  "fora",
);

// Pagamentos registados à mão substituem o recibo do mesmo contrato-mês, nunca se somam.
{
  const manuais = pagamentosManuais(
    [
      { id: "m1", contract_id: "c", voided: false },
      { id: "m2", contract_id: "c", voided: true },
    ],
    [
      { movement_id: "m1", ref_month: "2026-09-01", amount: 450 },
      { movement_id: "m1", ref_month: "2026-08-01", amount: 200 },
      { movement_id: "m2", ref_month: "2026-07-01", amount: 450 },
    ],
  );
  assert.equal(manuais.size, 2, "o movimento anulado não conta");
  const recibos = [
    { contract_id: "c", ref_month: "2026-09-01", amount: 450 },
    { contract_id: "c", ref_month: "2026-07-01", amount: 450 },
  ];
  const juntos = comPagamentosManuais(recibos, manuais, (m) => m);
  const setembro = juntos.filter((p) => p.ref_month === "2026-09-01");
  assert.equal(setembro.length, 1, "setembro não duplica");
  assert.equal(setembro[0].amount, 450);
  assert.equal(
    juntos.find((p) => p.ref_month === "2026-08-01")?.amount,
    200,
    "agosto entra pelo registo à mão",
  );
  assert.equal(juntos.find((p) => p.ref_month === "2026-07-01")?.amount, 450, "julho fica com o recibo");
  assert.equal(
    comPagamentosManuais(recibos, new Map(), (m) => m),
    recibos,
    "sem registos não mexe",
  );
}
assert.equal(
  monthStatement({
    ...base,
    movements: [{ ...movement, voided: true }],
    allocations: [{ movement_id: "m", ref_month: "2026-10-01", amount: 450 }],
  }).confirmed,
  0,
);
assert.deepEqual(
  parseAllocations("2026-10 = 0,10\n2026-11 = 0,20", 0.3).map((p) => p.amount),
  [0.1, 0.2],
);
assert.throws(() => parseAllocations("2026-10 = 300\n2026-10 = 300", 600));
assert.throws(() => parseAllocations("2026-13 = 600", 600));
assert.throws(() => parseAllocations("2026-10 = 599,99", 600));
assert.throws(() => parseAllocations("2026-10 = Infinity", Infinity));
const owners = [
  { property_id: "p", landlord_id: "l", quota: 50 },
  { property_id: "p", landlord_id: "x", quota: 25 },
];
const landlords: Landlord[] = [
  { id: "l", name: "A", nif: null, notes: null },
  { id: "x", name: "Terceiro", nif: null, notes: null, in_portfolio: false },
];
assert.equal(shareOf("p", owners, landlords, "inteiro"), 1);
assert.equal(shareOf("p", owners, landlords, "carteira"), 0.5);
assert.equal(shareOf("p", owners, landlords, "proprietario", "l"), 0.5);
assert.equal(shareOf("z", owners, landlords, "carteira"), null);
const expense: Expense = {
  id: "e",
  property_id: "p",
  landlord_id: "l",
  expense_date: "2026-10-01",
  category: "imi",
  amount: 100,
  description: null,
  origem: "registada",
};
assert.equal(scopedExpense(expense, owners, landlords, "proprietario", "l").amount, 100); // A quota não é aplicada duas vezes.
assert.deepEqual(scopedExpense(expense, owners, landlords, "inteiro"), { amount: 200, estimated: true });
// Dois co-titulares declaram o MESMO IMI (o avô e a avó, 2025): é um IMI, não dois.
{
  const doTerceiro: Expense = { ...expense, id: "e2", landlord_id: "x", amount: 50 };
  const todas = [expense, doTerceiro];
  const declarantes = quotasDeclarantes(todas, owners);
  const inteiro = todas.reduce(
    (n, e) => n + (scopedExpense(e, owners, landlords, "inteiro", undefined, declarantes).amount ?? 0),
    0,
  );
  assert.equal(inteiro, 200, "(100 + 50) ÷ 75% = 200, não 200 + 200");
  const semRegra = todas.reduce(
    (n, e) => n + (scopedExpense(e, owners, landlords, "inteiro").amount ?? 0),
    0,
  );
  assert.equal(semRegra, 400, "o bug: cada linha reconstruída para 100% e somada");
}
assert.equal(
  receiptCandidates(receipt, [contract, { ...contract, id: "c2", pf_contract_no: "2" }]).length,
  1,
);
assert.equal(
  receiptCandidates({ ...receipt, pf_contract_no: null }, [contract, { ...contract, id: "c2" }]).length,
  2,
); // Ambiguidade preservada.
assert.equal(declaredContractDates(contract).length, 0);
const february = monthStatement({
  ...base,
  contract: { ...contract, due_day: 31 },
  month: "2027-02-01",
  today: "2027-03-01",
  horizon: "2027-02-01",
  receipts: [],
  confirmations: [
    {
      contract_id: "c",
      ref_month: "2027-02-01",
      expected_amount: 600,
      note: "Conferido",
      confirmed_at: "2027-03-01",
      confirmed_by: "u",
    },
  ],
});
assert.equal(february.confirmedBalance, 600); // Vencimento a 31 é limitado ao último dia do mês.
assert.equal(
  declaredContractDates({
    ...contract,
    term_kind: "prazo_certo",
    expected_end_date: "2027-01-31",
    terms_confirmed_at: "2026-10-09",
    term_source: "Contrato assinado",
    notice_days_landlord: 30,
  })[1].date,
  "2027-01-01",
);
console.log("gestao.check.ts: OK (pagamentos, retenção, períodos, quotas, ambiguidades e prazos)");
