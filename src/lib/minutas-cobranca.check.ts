import assert from "node:assert/strict";
import {
  MINUTAS, minutaAcordo, passoDaEscada, textoCurto,
  type CartaEnviada, type DividaDaCarta, type MinutaDados,
} from "./minutas";

const DADOS: MinutaDados = {
  senhorio: "Senhorio de ensaio", senhorioNif: "100000000", inquilino: "Arrendatário de ensaio",
  inquilinoNif: "200000000", morada: "Rua de Ensaio, 1", fracaoRef: "1.º esquerdo",
  contratoNo: "ENSAIO-1", inicio: "2020-02-01", renda: 500, hoje: "2026-11-13",
};
const DIVIDA: DividaDaCarta = {
  meses: [{ mes: "2026-10-01", valor: 500 }, { mes: "2026-09-01", valor: 500.03 }],
  total: 1000.03,
};

function escada(mesesEmAtraso: number, cartas: CartaEnviada[] = [], hoje = DADOS.hoje) {
  return passoDaEscada({ mesesEmAtraso, cartas, hoje });
}

// A) A duração do atraso permite saltar o lembrete, mas nunca a interpelação.
{
  assert.deepEqual(escada(0), {
    passo: 0, proxima: null, quando: null, motivo: "Sem rendas em atraso.",
  });
  assert.equal(escada(1).proxima, "lembrete");
  for (const meses of [2, 3]) {
    assert.equal(escada(meses).passo, 0);
    assert.equal(escada(meses).proxima, "interpelacao");
    assert.equal(escada(meses).quando, DADOS.hoje);
  }
  const cartas: CartaEnviada[] = [{ tipo: "interpelacao", dia: "2026-11-04" }];
  assert.equal(escada(3, cartas).passo, 2);
  assert.equal(escada(3, cartas).proxima, "resolucao");
  assert.equal(escada(3, cartas).quando, DADOS.hoje);
  assert.equal(escada(2, cartas).quando, null, "falta o terceiro mês, sem data adivinhada");
  assert.equal(escada(0, cartas).passo, 2);
  assert.equal(escada(0, cartas).proxima, null);
  assert.equal(escada(0, cartas).motivo, "Sem rendas em atraso.");
}

// B) Dias de calendário: 15 após lembrete e apenas no nono após interpelação.
{
  const lembrete: CartaEnviada[] = [{ tipo: "lembrete", dia: "2026-10-30" }];
  assert.equal(escada(1, lembrete).passo, 1);
  assert.equal(escada(1, lembrete).proxima, "interpelacao");
  assert.equal(escada(1, lembrete).quando, "2026-11-14");
  assert.equal(escada(1, lembrete, "2026-11-14").quando, "2026-11-14");
  assert.equal(escada(1, lembrete, "2026-11-15").quando, "2026-11-15");
  assert.equal(escada(2, lembrete).quando, DADOS.hoje, "dois meses antecipam os 15 dias");
  const interpelacao: CartaEnviada[] = [{ tipo: "interpelacao", dia: "2026-11-05" }];
  assert.equal(escada(3, interpelacao).quando, "2026-11-14");
  assert.equal(escada(3, interpelacao, "2026-11-14").quando, "2026-11-14");
  assert.equal(escada(3, [{ tipo: "interpelacao", dia: "2028-02-28" }], "2028-03-08").quando,
    "2028-03-08", "a contagem atravessa fevereiro bissexto");
}

// C) A ordem do diário não altera o passo; outras cartas não avançam a cobrança.
{
  const cartas: CartaEnviada[] = [
    { tipo: "resolucao", dia: "2026-11-10" }, { tipo: "acordo", dia: "2026-11-11" },
    { tipo: "lembrete", dia: "2026-10-01" }, { tipo: "interpelacao", dia: "2026-10-20" },
  ];
  const copia = JSON.stringify(cartas);
  assert.equal(escada(3, cartas).passo, 3);
  assert.equal(escada(3, cartas).proxima, null);
  assert.equal(escada(3, cartas).quando, null);
  assert.equal(JSON.stringify(cartas), copia);
  assert.equal(escada(1, [{ tipo: "acordo", dia: DADOS.hoje }]).passo, 0);
  assert.equal(escada(1, [{ tipo: "lembrete", dia: "2026-11-14" }]).passo, 0);
}

function valoresDasPrestacoes(paragrafos: string[]): number[] {
  return paragrafos.filter((p) => /^Prestação \d+ \|/.test(p)).map((p) => {
    const valor = p.split(" | ")[2].replace(/[^\d,]/g, "").replace(",", ".");
    return Math.round(Number(valor) * 100);
  });
}

// D) O acerto fica na última prestação, incluindo datas no fim do mês.
{
  const plano = { divida: 1000, prestacoes: 3, primeira: "2027-01-31" };
  const acordo = minutaAcordo(DADOS, plano);
  assert.deepEqual(valoresDasPrestacoes(acordo.paragrafos), [33333, 33333, 33334]);
  assert.equal(valoresDasPrestacoes(acordo.paragrafos).reduce((a, b) => a + b), 100000);
  assert.match(acordo.paragrafos.join("\n"), /mil euros/);
  assert.match(acordo.paragrafos.join("\n"), /31 de janeiro de 2027/);
  assert.match(acordo.paragrafos.join("\n"), /28 de fevereiro de 2027/);
  assert.match(acordo.paragrafos.join("\n"), /31 de março de 2027/);
  assert.match(acordo.paragrafos.join("\n"), /acresce à renda corrente/);
  assert.match(acordo.paragrafos.join("\n"), /vencimento imediato/);
  assert.equal(acordo.assinaturas.length, 2);
  assert.deepEqual(valoresDasPrestacoes(minutaAcordo(DADOS,
    { ...plano, prestacoes: 1 }).paragrafos), [100000]);
  assert.match(minutaAcordo(DADOS, { ...plano, primeira: "2028-01-31" }).paragrafos.join("\n"),
    /29 de fevereiro de 2028/);
  assert.deepEqual(valoresDasPrestacoes(minutaAcordo(DADOS,
    { ...plano, divida: 1000.01 }).paragrafos), [33333, 33333, 33335]);
  for (const prestacoes of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => minutaAcordo(DADOS, { ...plano, prestacoes }), /prestações/i);
  }
  for (const divida of [0, -1, NaN, Infinity, 0.001, 1000.001]) {
    assert.throws(() => minutaAcordo(DADOS, { ...plano, divida }), /dívida/i);
  }
  assert.throws(() => minutaAcordo(DADOS, { ...plano, primeira: "2027-02-30" }), /data/i);
}

// E) Cartas concretas discriminam a dívida por ordem e calculam os 20% ao cêntimo.
{
  const copia = JSON.stringify(DIVIDA);
  for (const tipo of ["lembrete", "interpelacao", "resolucao"] as const) {
    const m = MINUTAS[tipo].construir(DADOS, DIVIDA);
    const texto = m.paragrafos.join("\n");
    assert.ok(texto.indexOf("setembro de 2026") < texto.indexOf("outubro de 2026"));
    assert.match(texto, /mil euros e três cêntimos/);
    assert.doesNotMatch(texto, /—|undefined|NaN|null| {2}/);
  }
  assert.equal(JSON.stringify(DIVIDA), copia);
  const lembrete = MINUTAS.lembrete.construir(DADOS, DIVIDA).paragrafos.join("\n");
  assert.match(lembrete, /8 dias/);
  assert.match(lembrete, /dificuldade/);
  assert.doesNotMatch(lembrete, /artigo|art\.|resolu|indemniza|judicial/i);
  const interpelacao = MINUTAS.interpelacao.construir(DADOS, DIVIDA).paragrafos.join("\n");
  assert.match(interpelacao, /8 dias a contar da receção/);
  assert.match(interpelacao, /1041.º, n.º 1/);
  assert.match(interpelacao, /200,01/);
  assert.match(interpelacao, /20%/);
  assert.equal(MINUTAS.interpelacao.envio, "registada");
  assert.match(MINUTAS.interpelacao.nota, /aviso de receção/);
  const resolucao = MINUTAS.resolucao.construir(DADOS, DIVIDA).paragrafos.join("\n");
  for (const artigo of ["1083.º, n.º 3", "1084.º, n.º 2", "1084.º, n.º 3", "9.º, n.º 7"]) {
    assert.ok(resolucao.includes(artigo), artigo);
  }
  assert.match(resolucao, /igual ou superior a três meses/);
  assert.match(resolucao, /intenção de resolver/);
  assert.match(resolucao, /prazo de um mês/);
  assert.match(resolucao, /Lei n.º 6\/2006/);
}

// F) A mensagem curta mantém a ação e o total mesmo com doze meses e nomes longos.
{
  const divida: DividaDaCarta = {
    meses: Array.from({ length: 12 }, (_, i) => ({ mes: `2025-${String(i + 1).padStart(2, "0")}-01`, valor: 500 })),
    total: 6000,
  };
  const texto = textoCurto("lembrete",
    { ...DADOS, inquilino: "Nome ".repeat(150), fracaoRef: "Morada ".repeat(150) }, divida);
  assert.ok(texto.length <= 400);
  assert.match(texto, /6[\s.]?000,00/);
  assert.match(texto, /8 dias/);
  assert.match(texto, /contact/i);
  assert.doesNotMatch(texto, /—|undefined|NaN|null| {2}/);
}

console.log("minutas-cobranca.check: OK");
