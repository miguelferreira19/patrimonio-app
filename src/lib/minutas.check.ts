// Self-check do ENQUADRAMENTO das minutas. Correr com `npm run check:minutas`.
// O que está aqui é a regra de quem vê que carta: se se partir, a app volta a oferecer
// uma oposição à renovação que é ineficaz ou uma interpelação a quem está em dia — e uma
// carta destas produz efeitos jurídicos.
import assert from "node:assert/strict";
import { ANOS_ATE_OPOSICAO, enquadrarMinutas, type FactosDaFracao } from "./minutas";

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
  assert.equal(bloqueio({ mesesEmAtraso: 1 }, "interpelacao"), null);
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
  assert.deepEqual(todas, ["renda", "interpelacao", "oposicao", "revogacao", "cessao"]);
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

console.log("minutas.check: OK");
