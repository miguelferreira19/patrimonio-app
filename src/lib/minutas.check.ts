// Self-check do ENQUADRAMENTO das minutas. Corre com `npm run check`.
// O que está aqui é a regra de quem vê que carta: se se partir, a app volta a oferecer
// uma oposição à renovação que é ineficaz ou uma interpelação a quem está em dia — e uma
// carta destas produz efeitos jurídicos.
import assert from "node:assert/strict";
import {
  ANOS_ATE_OPOSICAO, MINUTAS, MINUTA_RENDA, MINUTA_TIPOS, enquadrarMinutas,
  isMinutaTipo, minutaAtualizacaoRenda, type FactosDaFracao, type MinutaDados,
} from "./minutas";

const BASE: FactosDaFracao = {
  hoje: "2026-07-30",
  temContratoAtivo: true,
  inicioContrato: "2015-01-01",
  rendaElegivel: true,
  rendaElegivelDesde: "2026-01-01",
  temCoeficiente: true,
  mesesEmAtraso: 0,
};

function bloqueio(f: Partial<FactosDaFracao>, chave: string): string | null {
  const m = enquadrarMinutas({ ...BASE, ...f }).find((x) => x.chave === chave);
  assert.ok(m, `minuta ${chave} desapareceu da lista`);
  return m.bloqueio;
}

function disponiveis(f: Partial<FactosDaFracao>): string[] {
  return enquadrarMinutas({ ...BASE, ...f })
    .filter((m) => m.bloqueio === null)
    .map((m) => m.chave);
}

// A) Sem contrato ativo não há carta nenhuma: todas elas identificam um locado e um
//    arrendatário que aqui não existem.
{
  assert.deepEqual(disponiveis({ temContratoAtivo: false }), []);
  assert.match(
    bloqueio({ temContratoAtivo: false }, "renda") ?? "",
    /não tem contrato/,
    "o bloqueio tem de dizer que falta contrato, não outra coisa qualquer",
  );
}

// B) Atualização de renda: o caso que motivou tudo isto. Só aparece quando o contrato é
//    mesmo elegível, e o bloqueio diz a partir de quando.
{
  assert.equal(bloqueio({}, "renda"), null);
  assert.match(
    bloqueio({ rendaElegivel: false, rendaElegivelDesde: "2027-03-01" }, "renda") ?? "",
    /2027/,
    "a data de elegibilidade tem de aparecer na razão",
  );
  // Sem coeficiente do ano a carta saía sem o número que é o seu objeto.
  assert.match(bloqueio({ temCoeficiente: false }, "renda") ?? "", /coeficiente/);
  // Elegível mas sem coeficiente continua bloqueada: a ordem das razões importa.
  assert.notEqual(bloqueio({ temCoeficiente: false, rendaElegivel: true }, "renda"), null);
  // Sem data de início nem elegibilidade calculada: razão própria, não a da data.
  assert.match(
    bloqueio({ rendaElegivel: false, rendaElegivelDesde: null }, "renda") ?? "",
    /data de início/,
  );
}

// C) Interpelação por rendas em atraso: só a quem deve. Mandá-la a quem está em dia é um
//    erro que fica por escrito.
{
  assert.equal(bloqueio({ mesesEmAtraso: 0 }, "interpelacao") !== null, true);
  assert.notEqual(bloqueio({ mesesEmAtraso: 1 }, "interpelacao"), null);
  assert.equal(bloqueio({ mesesEmAtraso: 2 }, "interpelacao"), null);
  assert.equal(bloqueio({ mesesEmAtraso: 1 }, "lembrete"), null);
  assert.equal(bloqueio({ mesesEmAtraso: 2 }, "acordo"), null);
  const cartas = [{ tipo: "lembrete" as const, dia: "2026-07-15" }];
  assert.equal(bloqueio({ mesesEmAtraso: 1, cartas }, "interpelacao"), null);
  assert.notEqual(bloqueio({ mesesEmAtraso: 1, cartas }, "lembrete"), null);
  assert.notEqual(bloqueio({ mesesEmAtraso: 3 }, "resolucao"), null);
  assert.equal(bloqueio({ mesesEmAtraso: 3,
    cartas: [{ tipo: "interpelacao", dia: "2026-07-21" }] }, "resolucao"), null);
  assert.notEqual(bloqueio({ mesesEmAtraso: 3,
    cartas: [{ tipo: "interpelacao", dia: "2026-07-22" }] }, "resolucao"), null);
}

// D) Oposição à renovação: artigo 1097.º n.º 3, três anos de contrato. A fronteira é o
//    próprio dia do terceiro aniversário (já se pode).
{
  const inicio = "2024-03-15";
  const vespera = { inicioContrato: inicio, hoje: "2027-03-14" };
  const dia = { inicioContrato: inicio, hoje: "2027-03-15" };
  assert.notEqual(bloqueio(vespera, "oposicao"), null, "na véspera dos 3 anos ainda não pode");
  assert.equal(bloqueio(dia, "oposicao"), null, "no dia do 3.º aniversário já pode");
  assert.match(bloqueio(vespera, "oposicao") ?? "", /2027/);
  assert.equal(ANOS_ATE_OPOSICAO, 3);
  assert.match(bloqueio({ inicioContrato: null }, "oposicao") ?? "", /data de início/);
}

// E) Revogação e cessão dependem só de haver contrato: são acordos entre as partes, sem
//    prazo legal a cumprir.
{
  assert.equal(bloqueio({ mesesEmAtraso: 0, inicioContrato: null }, "revogacao"), null);
  assert.equal(bloqueio({ mesesEmAtraso: 0, inicioContrato: null }, "cessao"), null);
}

// F) A lista sai sempre inteira e pela mesma ordem: a página esconde as bloqueadas, mas
//    quem quiser mostrar a razão tem de as receber.
{
  const todas = enquadrarMinutas(BASE).map((m) => m.chave);
  assert.deepEqual(todas,
    ["renda", "lembrete", "interpelacao", "resolucao", "acordo", "oposicao", "revogacao", "cessao"]);
  assert.deepEqual(enquadrarMinutas({ ...BASE, temContratoAtivo: false }).map((m) => m.chave), todas);
  for (const m of enquadrarMinutas(BASE)) {
    assert.ok(m.label.length > 0 && m.descricao.length > 0 && m.base.length > 0, m.chave);
  }
}

// G) Um contrato novo em dia e ainda não atualizável: sobram as duas de acordo. É o caso
//    da maioria das frações, e é o que a página tem de conseguir mostrar sem parecer vazia.
{
  assert.deepEqual(
    disponiveis({ inicioContrato: "2025-06-01", hoje: "2026-01-10", rendaElegivel: false, rendaElegivelDesde: "2026-06-01" }),
    ["revogacao", "cessao"],
  );
}

const DADOS: MinutaDados = {
  senhorio: "Senhorio de ensaio", senhorioNif: null, inquilino: "Arrendatário de ensaio",
  inquilinoNif: null, morada: "Rua de Ensaio, 1", fracaoRef: "1.º esquerdo",
  contratoNo: null, inicio: null, renda: 500, hoje: "2026-11-13",
};

// H) Todos os tipos continuam editáveis com dados mínimos e completos.
{
  const completos: MinutaDados = {
    ...DADOS, senhorioNif: "100000000", inquilinoNif: "200000000", contratoNo: "ENSAIO-1",
    inicio: "2020-02-01", fimContrato: "2027-02-01", antecedenciaDias: 120,
    divida: { meses: [{ mes: "2026-09-01", valor: 500 }], total: 500 },
  };
  for (const d of [DADOS, completos]) {
    const cartas = MINUTA_TIPOS.map((tipo) => MINUTAS[tipo].construir(d));
    cartas.push(minutaAtualizacaoRenda(d,
      { ano: 2027, coeficiente: 1.02, novaRenda: 510, desde: "2027-02-01" }));
    for (const m of cartas) {
      const texto = [m.assunto, ...m.paragrafos, ...m.assinaturas, m.nota].join("\n");
      assert.doesNotMatch(texto, /—|undefined|NaN|null| {2}/, m.assunto);
      assert.ok(m.paragrafos.every((p) => !p.includes("Rever com advogado antes de enviar.")));
    }
    const renda = minutaAtualizacaoRenda(d,
      { ano: 2027, coeficiente: 1.02, novaRenda: 510, desde: "2027-02-01" });
    assert.match(renda.paragrafos.join("\n"), /1 de fevereiro de 2027/);
  }
  for (const tipo of MINUTA_TIPOS) {
    assert.equal(isMinutaTipo(tipo), true);
    assert.ok(MINUTAS[tipo].nota.length > 0);
    assert.ok(["simples", "registada"].includes(MINUTAS[tipo].envio));
  }
  assert.equal(isMinutaTipo("desconhecida"), false);
  for (const tipo of ["resolucao", "oposicao"] as const) {
    assert.ok(MINUTAS[tipo].nota.includes("Rever com advogado antes de enviar."));
  }
  assert.equal(MINUTA_RENDA.envio, "registada");
  assert.ok(MINUTA_RENDA.nota.includes("24.º"));
  const oposicao = MINUTAS.oposicao.construir(completos).paragrafos.join("\n");
  assert.match(oposicao, /1097.º/);
  assert.match(oposicao, /120 dias/);
  assert.match(oposicao, /1 de fevereiro de 2027/);
  assert.doesNotMatch(oposicao, /\d{2}\/\d{2}\/\d{4}/);
}

console.log("minutas.check: OK");
