// Self-check de faltas.ts. Corre com `npm run check`.
import assert from "node:assert/strict";
import { faltasPorMes, tiraDoInquilino } from "./faltas";
import type { MonthCellData, MonthCellStatus } from "../monthcell";
import type { Snapshot } from "./snapshot";

const cel = (month: string, status: MonthCellStatus, paid: number, expected = 500): MonthCellData => ({
  month,
  status,
  paid,
  expected,
});

type Corrente = Snapshot["correntes"][number];
const ativo = (id: string, nome: string, faixa: MonthCellData[]): Corrente =>
  ({ activeContract: { id, tenant_name: nome }, property: { id: `p-${id}` }, faixa }) as unknown as Corrente;

const snap = {
  faixaMeses: ["2026-08-01", "2026-09-01", "2026-10-01"],
  correntes: [
    // paga sempre
    ativo("a", "Ana", [cel("2026-08-01", "pago", 500), cel("2026-09-01", "pago", 500), cel("2026-10-01", "pago", 500)]),
    // falta setembro e outubro
    ativo("b", "Bruno", [cel("2026-08-01", "pago", 500), cel("2026-09-01", "falta", 0), cel("2026-10-01", "falta", 0)]),
    // outubro pago em parte (200 de 500) e agosto sem contrato
    ativo("c", "Carla", [cel("2026-08-01", "fora", 0, 0), cel("2026-09-01", "pago", 500), cel("2026-10-01", "parcial", 200)]),
    // fonte parada: setembro e outubro por importar, não são falta
    ativo("d", "Duarte", [cel("2026-08-01", "pago", 500), cel("2026-09-01", "futuro", 0), cel("2026-10-01", "futuro", 0)]),
  ],
} as Pick<Snapshot, "correntes" | "faixaMeses">;

const r = faltasPorMes(snap, 12);
assert.deepEqual(r.map((m) => m.month), snap.faixaMeses, "devolve os meses da faixa por ordem");

// Agosto: Carla fora e nada em falta; esperado = 3 contratos.
assert.equal(r[0].esperado, 1500);
assert.equal(r[0].falta, 0);
assert.equal(r[0].contratos.length, 0);

// Setembro: só o Bruno falta; o Duarte (futuro) não conta nem como esperado.
assert.equal(r[1].esperado, 1500);
assert.equal(r[1].recebido, 1000);
assert.equal(r[1].falta, 500);
assert.deepEqual(r[1].contratos.map((c) => c.nome), ["Bruno"]);

// Outubro: Bruno inteiro (500) + Carla em parte (300 de défice).
assert.equal(r[2].esperado, 1500);
assert.equal(r[2].falta, 800);
assert.equal(r[2].recebido, 700);
assert.equal(r[2].recebido + r[2].falta, r[2].esperado, "recebido + falta = esperado");
assert.deepEqual(r[2].contratos.map((c) => [c.nome, c.emParte]), [["Bruno", false], ["Carla", true]]);

// A janela corta nos últimos n meses.
assert.deepEqual(faltasPorMes(snap, 2).map((m) => m.month), ["2026-09-01", "2026-10-01"]);

// Dois contratos do mesmo inquilino: a tira mostra o pior estado de cada mês.
assert.deepEqual(
  tiraDoInquilino([
    ["pago", "pago", "falta"],
    ["pago", "parcial", "pago"],
  ]),
  ["pago", "parcial", "falta"],
);
assert.deepEqual(tiraDoInquilino([["fora", "pago"], ["futuro", "pago"]]), ["futuro", "pago"]);
assert.deepEqual(tiraDoInquilino([]), []);
// Tiras de comprimento diferente alinham pela direita (o mês mais recente).
assert.deepEqual(tiraDoInquilino([["falta", "pago"], ["pago"]]), ["pago"]);

console.log("faltas.check OK");
