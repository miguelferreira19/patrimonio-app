// Self-check de validar.ts. Corre com `npm run check`.
import assert from "node:assert/strict";
import {
  eData,
  validarAtualizacaoRenda,
  validarContrato,
  validarDespesa,
  validarTitulares,
  validarRegistoNoDiario,
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

const registo = {
  contractId: "11111111-1111-4111-8111-111111111111",
  requestId: "22222222-2222-4222-8222-222222222222",
  kind: "contacto" as const, note: " Falámos hoje. ", occurredOn: "2026-11-13",
};
const hoje = "2026-11-13";
assert.equal(validarRegistoNoDiario(registo, hoje).note, "Falámos hoje.");
validarRegistoNoDiario({ ...registo, note: "a".repeat(500) }, hoje);
for (const note of ["", "   ", "a".repeat(501)]) {
  assert.throws(() => validarRegistoNoDiario({ ...registo, note }, hoje), /500/);
}
for (const occurredOn of ["2026-02-30", "13/11/2026", "2026-11-14"]) {
  assert.throws(() => validarRegistoNoDiario({ ...registo, occurredOn }, hoje), /data/i);
}
assert.throws(() => validarRegistoNoDiario({ ...registo, kind: "promessa" }, hoje), /prometida/);
assert.throws(() => validarRegistoNoDiario({ ...registo, kind: "promessa", dueDate: "2026-11-12" }, hoje), /anterior/);
assert.throws(() => validarRegistoNoDiario({ ...registo, dueDate: "2026-02-30" }, hoje), /data/i);
for (const amount of [0, -1, NaN, Infinity, "abc"]) {
  assert.throws(() => validarRegistoNoDiario({ ...registo, kind: "promessa", dueDate: hoje, amount }, hoje), /valor/i);
}
assert.equal(validarRegistoNoDiario({ ...registo, kind: "promessa", dueDate: hoje, amount: "1.200,50" }, hoje).amount, 1200.5);
assert.equal(validarRegistoNoDiario({ ...registo, kind: "promessa", dueDate: hoje }, hoje).amount, undefined);
validarRegistoNoDiario({ ...registo, kind: "carta" }, hoje);
validarRegistoNoDiario({ ...registo, kind: "nota" }, hoje);
assert.throws(() => validarRegistoNoDiario({ ...registo, kind: "visita" }, hoje), /tipo/i);
assert.throws(() => validarRegistoNoDiario({ ...registo, contractId: "x" }, hoje), /Contrato/);
assert.throws(() => validarRegistoNoDiario({ ...registo, requestId: "x" }, hoje), /operação/);
console.log("validar.check.ts: OK (diário, datas, promessa, montante e identificação)");
