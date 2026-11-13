import assert from "node:assert/strict";
import { estadoDaRecolha, type CorridaDaRecolha } from "./recolha";
import { carregarCorridasDaRecolha } from "./recolha-load";

const HOJE = "2026-11-13";
const corrida = (dia: string, account = "Conta A", ok = true): CorridaDaRecolha => ({
  account, started_at: `${dia}T09:00:00Z`, finished_at: `${dia}T10:00:00Z`, ok,
});
const esperado = (dias: number, texto: string, tom = "tinta") => ({ dias, tom, texto });

assert.deepEqual(estadoDaRecolha([], HOJE), {
  dias: null, tom: "tinta", texto: "Leitura de recibos por configurar",
});
for (const [dia, dias, texto] of [
  ["2026-11-13", 0, "Recibos lidos hoje"],
  ["2026-11-12", 1, "Recibos lidos ontem"],
  ["2026-11-11", 2, "Recibos lidos há 2 dias"],
  ["2026-11-07", 6, "Recibos lidos há 6 dias"],
  ["2026-11-06", 7, "Recibos lidos há 7 dias"],
] as const) {
  assert.deepEqual(estadoDaRecolha([corrida(dia)], HOJE), esperado(dias, texto, dias > 6 ? "perda" : "tinta"));
}
const contas = [corrida("2026-11-12", "A"), corrida("2026-11-07", "B"), corrida("2026-11-01", "A", false)];
const copia = structuredClone(contas);
assert.deepEqual(estadoDaRecolha(contas, HOJE), esperado(6, "Recibos lidos há 6 dias"));
assert.deepEqual(contas, copia, "não altera nem reordena as corridas");
assert.deepEqual(estadoDaRecolha([...contas, corrida("2026-11-13", "B", false)], HOJE),
  esperado(1, "Leitura de recibos falhou", "perda"));
assert.deepEqual(estadoDaRecolha([corrida(HOJE, "A", false)], HOJE), {
  dias: null, tom: "perda", texto: "Leitura de recibos falhou",
});
assert.deepEqual(estadoDaRecolha([{ ...corrida(HOJE), finished_at: null }], HOJE),
  esperado(0, "Recibos lidos hoje"));
assert.deepEqual(estadoDaRecolha([corrida("2026-10-31")], "2026-11-01"),
  esperado(1, "Recibos lidos ontem"));
assert.deepEqual(estadoDaRecolha([{ ...corrida("2026-07-12"), finished_at: "2026-07-12T23:30:00Z" }], "2026-07-13"),
  esperado(0, "Recibos lidos hoje"), "dias civis de Lisboa, incluindo a hora de verão");

async function verificarLoader() {
  let codigo: string | null = null;
  const pedidos: unknown[][] = [];
  const query = {
    select: (campos: string) => { pedidos.push(["select", campos]); return query; },
    order: (coluna: string, opcoes: unknown) => { pedidos.push(["order", coluna, opcoes]); return query; },
    limit: async (n: number) => {
      pedidos.push(["limit", n]);
      return { data: codigo ? null : contas, error: codigo ? { code: codigo, message: "ensaio" } : null };
    },
  };
  const cliente = { from: (tabela: string) => { pedidos.push(["from", tabela]); return query; } };
  const ler = () => carregarCorridasDaRecolha(cliente as unknown as Parameters<typeof carregarCorridasDaRecolha>[0]);
  assert.deepEqual(await ler(), contas);
  assert.deepEqual(pedidos, [["from", "collection_runs"],
    ["select", "account,finished_at,started_at,ok"], ["order", "started_at", { ascending: false }], ["limit", 20]]);
  for (codigo of ["42P01", "PGRST205"]) assert.deepEqual(await ler(), []);
  for (codigo of ["42501", "PGRST301", "57014"]) await assert.rejects(ler(), /collection_runs.*ensaio/);
}
verificarLoader().then(() => console.log("OK: recolha, contas, limites 6/7 dias e erros do loader (sintético)."))
  .catch((erro) => { console.error(erro); process.exitCode = 1; });
