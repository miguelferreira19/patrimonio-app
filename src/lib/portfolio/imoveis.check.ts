// Self-check de imoveis.ts. Corre com `npm run check`.
import assert from "node:assert/strict";
import { filtrarPredios, piorEstado, resumirPredios } from "./imoveis";
import type { MonthCellStatus } from "../monthcell";
import type { Snapshot } from "./snapshot";

// A. Pior estado do mês: uma fração em falta faz o mês do prédio em falta.
assert.equal(piorEstado(["pago", "pago", "falta"]), "falta");
assert.equal(piorEstado(["pago", "fora"]), "pago", "sem contrato não esconde um mês pago");
assert.equal(piorEstado(["fora", "fora"]), "fora");
assert.equal(piorEstado([]), "fora");

// B. Agregados por prédio a partir de um snapshot mínimo.
const cel = (...s: MonthCellStatus[]) => s.map((status, i) => ({ month: `2026-0${i + 1}-01`, status, paid: 0, expected: 0 }));
const ativo = (id: string, matriz: string, o: { contrato?: string; renda?: number; faixa?: MonthCellStatus[]; corrente?: boolean; senhorio?: string; atualizavel?: boolean } = {}) => ({
  property: { id, name: id, matriz_article: matriz, address: "Rua das Flores Nº: 1", parish: null, municipality: null, typology: null },
  activeContract: o.contrato ? { id: o.contrato, rent: o.renda ?? 0 } : null,
  corrente: o.corrente ?? true,
  faixa: cel(...(o.faixa ?? ["pago", "pago", "pago", "pago", "pago", "pago"])),
  titulares: [{ landlord: { id: o.senhorio ?? "L1" } }],
  rendaAtualizavel: o.atualizavel ? { eligible: true, suggestedRent: (o.renda ?? 0) + 10 } : null,
});
const snap = {
  ativos: [
    ativo("a", "1-U-10-A", { contrato: "ca", renda: 400, faixa: ["pago", "pago", "pago", "pago", "pago", "falta"] }),
    ativo("b", "1-U-10-B", { contrato: "cb", renda: 300 }),
    ativo("c", "1-U-10-C"), // vaga
    ativo("d", "1-U-20", { contrato: "cd", renda: 500, senhorio: "L2", atualizavel: true }),
    ativo("e", "1-U-30", { contrato: "ce", renda: 200 }),
    ativo("t", "1-R-5", { corrente: false }),
  ],
  fontes: [{ landlord: { id: "AVO" }, parada: true }],
  fonteDoContrato: { ce: "AVO" },
  arrears: { rows: [{ propertyId: "a", debt: 800, severity: "atraso" }, { propertyId: "d", debt: 50, severity: "ritmo_proprio" }] },
} as unknown as Pick<Snapshot, "ativos" | "fontes" | "fonteDoContrato" | "arrears">;

const predios = resumirPredios(snap);
const p10 = predios.find((p) => p.chave === "1-U-10")!;
assert.equal(p10.fracoes.length, 3);
assert.equal(p10.arrendadas, 2);
assert.equal(p10.renda, 700);
assert.equal(p10.divida, 800);
assert.equal(p10.estado, "atraso", "dívida vence vaga");
assert.equal(p10.meses.length, 6);
assert.equal(p10.meses[4], "falta", "o último mês fechado em falta (a fração A)");
assert.equal(p10.meses[5], "curso", "o último quadrado é sempre o mês em curso");
const p20 = predios.find((p) => p.chave === "1-U-20")!;
assert.equal(p20.divida, 0, "ritmo próprio não conta como atraso (mesma regra da tarefa Cobrar)");
assert.equal(p20.estado, "em_dia");
assert.equal(predios.find((p) => p.chave === "1-U-30")!.estado, "parado");
assert.equal(predios.find((p) => p.tipo === "terrenos")!.estado, "terreno");

// C. Filtros e ordem.
assert.deepEqual(filtrarPredios(predios, { filtro: "atraso" }).map((p) => p.chave), ["1-U-10"]);
assert.deepEqual(filtrarPredios(predios, { filtro: "vagas" }).map((p) => p.chave), ["1-U-10"]);
assert.deepEqual(filtrarPredios(predios, { filtro: "atualizavel" }).map((p) => p.chave), ["1-U-20"]);
assert.deepEqual(filtrarPredios(predios, { senhorio: "L2" }).map((p) => p.chave), ["1-U-20"]);
const porEstado = filtrarPredios(predios, {}).map((p) => p.estado);
assert.deepEqual(porEstado, ["atraso", "parado", "em_dia", "terreno"], "atraso primeiro, terrenos no fim");
assert.equal(filtrarPredios(predios, { ordem: "renda" })[0].chave, "1-U-10");
assert.deepEqual(filtrarPredios(predios, { filtro: "parados" }).map((p) => p.chave), ["1-U-30"]);
assert.equal(filtrarPredios([{ ...p10, recibosParados: true }], { filtro: "parados" }).length, 1, "atraso não esconde uma fonte parada");

console.log("imoveis.check.ts: OK (A, B, C)");
