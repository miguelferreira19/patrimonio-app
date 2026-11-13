import assert from "node:assert/strict";
import { cartasDoDiario, dividaDaCarta, cartasDoCiclo, planoDoAcordo } from "./cartas-diario";
import type { EventoDoDiario } from "./diario";
import type { ContratoEmAtraso } from "./inquilinos";

const evento = (texto: string, over: Partial<EventoDoDiario> = {}): EventoDoDiario => ({
  id: texto, contratoId: "c1", dia: "2026-11-03", tipo: "carta", texto, autor: null, ...over,
});
const diario = [evento("interpelacao: Interpelação"), evento("lembrete: Lembrete", { dia: "2026-10-01" }),
  evento("nota: outro"), evento("acordo: Acordo"), evento("lembrete: Não enviada", { tipo: "nota" }),
  evento("lembrete sem separador"), evento("resolucao: Aviso", { dia: "2026-02-30" }),
  evento("lembrete: Outro contrato", { contratoId: "c2" }),
  evento("oposicao: Oposição", { dia: "2026-12-01" })];
const copia = structuredClone(diario);
assert.deepEqual(cartasDoDiario(diario), [
  { tipo: "lembrete", dia: "2026-10-01" }, { tipo: "interpelacao", dia: "2026-11-03" },
  { tipo: "acordo", dia: "2026-11-03" }, { tipo: "lembrete", dia: "2026-11-03" },
  { tipo: "oposicao", dia: "2026-12-01" },
]);
assert.deepEqual(cartasDoCiclo(diario, "c1", "2026-10-15", "2026-11-13"), [
  { tipo: "interpelacao", dia: "2026-11-03" }, { tipo: "acordo", dia: "2026-11-03" },
]);
assert.deepEqual(diario, copia);
assert.deepEqual(cartasDoDiario([]), []);

const atraso = { desde: "2026-08-01", meses: 3, divida: 1000 } as ContratoEmAtraso;
assert.deepEqual(dividaDaCarta(atraso), { total: 1000, meses: [
  { mes: "2026-08-01", valor: 333.33 }, { mes: "2026-09-01", valor: 333.33 },
  { mes: "2026-10-01", valor: 333.34 },
] });
assert.deepEqual(dividaDaCarta(undefined), { total: 0, meses: [] });
assert.equal(dividaDaCarta({ ...atraso, meses: 1, divida: 450.15 }).meses[0].valor, 450.15);
assert.deepEqual(planoDoAcordo({}, "2026-11-13"), { prestacoes: 3, primeira: "2026-11-13" });
assert.deepEqual(planoDoAcordo({ prestacoes: "24", primeira: "2026-12-31" }, "2026-11-13"),
  { prestacoes: 24, primeira: "2026-12-31" });
for (const prestacoes of ["0", "25", "1.5", "abc"]) {
  assert.throws(() => planoDoAcordo({ prestacoes }, "2026-11-13"), /prestações/);
}
assert.throws(() => planoDoAcordo({ primeira: "2026-02-30" }, "2026-11-13"), /data/i);
console.log("cartas-diario.check.ts: OK (tipos, ciclo, contrato, dívida e plano)");
