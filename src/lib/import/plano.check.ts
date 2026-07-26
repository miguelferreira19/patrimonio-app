// Self-check do planeador de importação. É o GATE da Fase 6: enquanto isto passar, o
// caminho novo de import concorda com o pipeline Python (`dados/gerar_sql_import.py`),
// que continua a ser a reversão oficial.
//
// Os casos são sintéticos, e de propósito: os ficheiros reais têm dados pessoais e estão
// fora do git (CLAUDE.md). O que se prova aqui são as REGRAS que o Python aplica aos
// ficheiros reais — anulados fora, multi-mês repartido, soma exata ao cêntimo, numeração
// "contrato/recibo#parte" e dedupe global. A equivalência com os `Analise_*.md` sobre os
// dados verdadeiros continua a fazer-se correndo o Python.

import assert from "node:assert";
import {
  construirPlano,
  dividirValor,
  mesesAbrangidos,
  resumirPlano,
  type EstadoAtual,
  type LinhaRecibo,
} from "./plano";

const vazio = (): EstadoAtual => ({
  recibos: new Map(),
  matrizes: new Set(["182341-U-4260-1ºPES"]),
  contratos: new Set(["68665"]),
});

const linha = (over: Partial<LinhaRecibo> = {}): LinhaRecibo => ({
  nContrato: "68665",
  nRecibo: "1",
  matriz: "182341-U-4260-1ºPES",
  locatario: "FERNANDO NEVES",
  dataInicio: "2026-01-01",
  dataFim: "2026-01-31",
  dataRecibo: "2026-01-05",
  valor: 296,
  importanciaRecebida: 296,
  estado: "Emitido",
  ...over,
});

// A — a soma das parcelas é EXATAMENTE o total, sem cêntimos perdidos.
{
  for (const [total, n] of [
    [296, 1],
    [100, 3],
    [331, 7],
    [0.05, 4],
    [1000.01, 6],
  ] as Array<[number, number]>) {
    const partes = dividirValor(total, n);
    assert.equal(partes.length, n, `${n} parcelas`);
    const soma = Math.round(partes.reduce((a, p) => a + p, 0) * 100) / 100;
    assert.equal(soma, total, `soma de ${n} parcelas de ${total} = ${soma}`);
    for (const p of partes) {
      // Comparar `p * 100` a um inteiro falha em vírgula flutuante (33.34 * 100 =
      // 3334.0000000000005). O que interessa é que arredonde a si próprio ao cêntimo.
      assert.ok(Math.abs(p * 100 - Math.round(p * 100)) < 1e-6, `parcela ${p} tem 2 casas`);
    }
  }
}

// B — meses abrangidos, incluindo o caso de um recibo dentro do mesmo mês.
{
  assert.deepEqual(mesesAbrangidos("2026-01-01", "2026-01-31"), ["2026-01-01"]);
  assert.deepEqual(mesesAbrangidos("2025-11-15", "2026-02-14"), [
    "2025-11-01",
    "2025-12-01",
    "2026-01-01",
    "2026-02-01",
  ]);
  assert.deepEqual(mesesAbrangidos("2026-03-01", "2026-01-01"), [], "periodo invertido");
  assert.ok(
    mesesAbrangidos("1900-01-01", "2100-01-01").length <= 120,
    "teto de seguranca contra datas mal lidas",
  );
}

// C — um recibo de um mês: uma linha, numeração SEM sufixo.
{
  const p = construirPlano([linha()], vazio());
  assert.equal(p.novos.length, 1);
  assert.equal(p.novos[0].receipt_number, "68665/1", "sem #parte quando e um so mes");
  assert.equal(p.novos[0].amount, 296);
  assert.equal(p.novos[0].ref_month, "2026-01-01");
  assert.equal(p.totalNovos, 296);
}

// D — recibo multi-mês: N linhas, sufixo #i, e a soma bate com o valor do recibo.
{
  const p = construirPlano(
    [linha({ nRecibo: "9", dataInicio: "2026-01-01", dataFim: "2026-03-31", valor: 100 })],
    vazio(),
  );
  assert.equal(p.novos.length, 3, "tres meses, tres linhas");
  assert.deepEqual(
    p.novos.map((r) => r.receipt_number),
    ["68665/9#1", "68665/9#2", "68665/9#3"],
  );
  assert.equal(p.totalNovos, 100, "as parcelas somam o valor do recibo");
  assert.deepEqual(
    p.novos.map((r) => r.ref_month),
    ["2026-01-01", "2026-02-01", "2026-03-01"],
  );
}

// E — retenção na fonte: sai das MESMAS parcelas, e a soma bate com o recibo.
{
  const p = construirPlano(
    [linha({ valor: 300, importanciaRecebida: 225, dataFim: "2026-02-28" })],
    vazio(),
  );
  const somaRet = Math.round(p.novos.reduce((a, r) => a + r.withholding, 0) * 100) / 100;
  assert.equal(somaRet, 75, "300 - 225 = 75, distribuido pelas fatias");
}

// F — "Anulado" NUNCA entra, mas conta-se.
{
  const p = construirPlano([linha({ estado: "Anulado" }), linha({ nRecibo: "2" })], vazio());
  assert.equal(p.anulados, 1);
  assert.equal(p.novos.length, 1, "so o emitido entra");
}

// G — dedupe contra a base: mesmo receipt_number e mesmo valor = duplicado, nao se toca.
{
  const estado = vazio();
  estado.recibos.set("68665/1", 296);
  const p = construirPlano([linha()], estado);
  assert.equal(p.novos.length, 0, "nada a inserir");
  assert.equal(p.duplicados, 1);
  assert.equal(p.divergencias.length, 0);
}

// H — mesmo receipt_number com valor DIFERENTE: divergência, e NÃO se sobrescreve.
{
  const estado = vazio();
  estado.recibos.set("68665/1", 290);
  const p = construirPlano([linha({ valor: 296 })], estado);
  assert.equal(p.novos.length, 0, "uma divergencia nunca vira insert");
  assert.equal(p.divergencias.length, 1);
  assert.equal(p.divergencias[0].valorNaBase, 290);
  assert.equal(p.divergencias[0].valorNoFicheiro, 296);
}

// I — dedupe GLOBAL dentro do ficheiro: o mesmo recibo vindo de dois senhorios
// (compropriedade) colide numa linha só. É a regra que o CLAUDE.md manda nunca relaxar.
{
  const p = construirPlano([linha(), linha()], vazio());
  assert.equal(p.novos.length, 1, "o mesmo recibo duas vezes insere UMA linha");
  assert.equal(p.duplicados, 1);
}

// J — tolerância de um cêntimo: arredondamento não conta como divergência.
{
  const estado = vazio();
  estado.recibos.set("68665/1", 296.01);
  const p = construirPlano([linha({ valor: 296 })], estado);
  assert.equal(p.divergencias.length, 0, "um centimo e arredondamento, nao divergencia");
  assert.equal(p.duplicados, 1);
}

// K — linhas ilegíveis são NOMEADAS, não silenciosamente ignoradas.
{
  const p = construirPlano(
    [
      linha({ nContrato: "" }),
      linha({ nRecibo: "3", dataInicio: null }),
      linha({ nRecibo: "4", valor: null }),
      linha({ nRecibo: "5", dataInicio: "2026-05-01", dataFim: "2026-01-01" }),
    ],
    vazio(),
  );
  assert.equal(p.novos.length, 0);
  assert.equal(p.invalidas.length, 4, "as quatro sao reportadas");
  assert.ok(
    p.invalidas.every((i) => i.linha > 0 && i.porque.length > 0),
    "cada uma com o numero da linha e a razao",
  );
}

// L — entidades desconhecidas aparecem no plano ANTES de qualquer escrita.
{
  const p = construirPlano(
    [linha({ matriz: "999-U-1-Z", nContrato: "77777" })],
    vazio(),
  );
  assert.deepEqual(p.matrizesDesconhecidas, ["999-U-1-Z"]);
  assert.deepEqual(p.contratosDesconhecidos, ["77777"]);
}

// M — o resumo é PT-PT e diz sempre quantos recibos novos há.
{
  const p = construirPlano([linha(), linha({ nRecibo: "2", estado: "Anulado" })], vazio());
  const r = resumirPlano(p);
  assert.ok(r.includes("1 recibo novo"), r);
  assert.ok(r.includes("1 anulados"), r);
}

console.log("plano.check.ts: OK (A, B, C, D, E, F, G, H, I, J, K, L, M)");
