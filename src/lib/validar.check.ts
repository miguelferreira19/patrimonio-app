// Self-check de validar.ts. Corre com `npm run check`.
import assert from "node:assert/strict";
import {
  eData,
  validarAtualizacaoRenda,
  validarContrato,
  validarDespesa,
  validarTitulares,
} from "./validar";

// A. Datas: só dias que existem.
assert.equal(eData("2026-10-03"), true);
assert.equal(eData("2026-02-30"), false);
assert.equal(eData("03/10/2026"), false);
assert.equal(eData(""), false);

// B. Quotas: abaixo de 100 é legítimo (compropriedade fora da família), acima não.
validarTitulares([{ landlord_id: "a", quota: 50 }]);
validarTitulares([
  { landlord_id: "a", quota: 33.33 },
  { landlord_id: "b", quota: 33.33 },
  { landlord_id: "c", quota: 33.34 },
]);
assert.throws(() => validarTitulares([{ landlord_id: "a", quota: 60 }, { landlord_id: "b", quota: 60 }]), /120%/);
assert.throws(() => validarTitulares([{ landlord_id: "a", quota: Number.NaN }]), /entre 0 e 100/);
assert.throws(() => validarTitulares([{ landlord_id: "a", quota: 0 }]), /entre 0 e 100/);
assert.throws(
  () => validarTitulares([{ landlord_id: "a", quota: 50 }, { landlord_id: "a", quota: 50 }]),
  /duas vezes/,
);

// C. Contrato: o NaN que um formulário partido mandava, e datas trocadas.
const base = { tenant_name: "Ana", rent: 850, due_day: 8 };
validarContrato(base);
validarContrato({ ...base, start_date: "2024-01-01", end_date: null });
assert.throws(() => validarContrato({ ...base, rent: Number.NaN }), /renda/);
assert.throws(() => validarContrato({ ...base, rent: -1 }), /renda/);
assert.throws(() => validarContrato({ ...base, due_day: 31 }), /vencimento/);
assert.throws(() => validarContrato({ ...base, tenant_name: "  " }), /inquilino/);
assert.throws(
  () => validarContrato({ ...base, start_date: "2025-01-01", end_date: "2024-01-01" }),
  /anterior/,
);

// D. Despesas e atualizações de renda.
validarDespesa({ expense_date: "2026-05-31", amount: 312.4 });
assert.throws(() => validarDespesa({ expense_date: "2026-05-31", amount: -10 }), /acima de zero/);
validarAtualizacaoRenda({ new_rent: 868.7, effective_date: "2026-11-01" });
assert.throws(() => validarAtualizacaoRenda({ new_rent: 0, effective_date: "2026-11-01" }), /acima de zero/);

console.log("validar.check.ts: OK (A, B, C, D)");
