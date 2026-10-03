// Self-check de agenda.ts. Corre com `npm run check`.
import assert from "node:assert/strict";
import { construirAgenda, prazosDeRenda, prazosFiscais, type RendaAtualizavel } from "./agenda";

const renda = (o: Partial<RendaAtualizavel>): RendaAtualizavel => ({
  contractId: "c1",
  fracao: "R. das Flores 12",
  inquilino: "Ana",
  renda: 800,
  elegivelDesde: "2026-12-01",
  rendaSugerida: 817.28,
  ...o,
});

// A. O calendário fiscal de um ano: IMI em maio, agosto e novembro, IRS a 30 de junho, e o
//    AIMI só aparece quando há imposto a pagar.
{
  const p = prazosFiscais(2026);
  assert.deepEqual(
    p.map((x) => x.data),
    ["2026-05-31", "2026-06-30", "2026-08-31", "2026-11-30"],
  );
  assert.ok(p.find((x) => x.id === "irs-2026")!.titulo.includes("IRS 2025"));
  const comAimi = prazosFiscais(2026, [{ senhorio: "Miguel", valor: 1234.5 }, { senhorio: "Eva", valor: 0 }]);
  const aimi = comAimi.find((x) => x.id === "aimi-2026")!;
  assert.equal(aimi.data, "2026-09-30");
  assert.equal(aimi.euros, 1234.5, "só soma quem paga");
  assert.ok(!aimi.detalhe.includes("Eva"), "quem não paga AIMI não aparece");
}

// B. A carta sai 30 dias antes da elegibilidade.
{
  const [p] = prazosDeRenda([renda({})], "2026-10-03", "2027-01-31");
  assert.equal(p.data, "2026-11-01");
  assert.equal(p.href, "/carta/c1");
  assert.ok(Math.abs(p.euros! - 207.36) < 0.01, "ganho anual = (sugerida − atual) × 12");
}

// C. Faltam menos de 30 dias: o prazo é HOJE, não uma data que já passou.
{
  const [p] = prazosDeRenda([renda({ elegivelDesde: "2026-10-20" })], "2026-10-03", "2027-01-31");
  assert.equal(p.data, "2026-10-03");
}

// D. Já elegível: está na fila do Agora, não se repete aqui. Renda que não sobe também não.
{
  assert.equal(prazosDeRenda([renda({ elegivelDesde: "2026-09-01" })], "2026-10-03", "2027-01-31").length, 0);
  assert.equal(prazosDeRenda([renda({ rendaSugerida: 790 })], "2026-10-03", "2027-01-31").length, 0);
  // Sem coeficiente do ano ainda se avisa, mas sem euros inventados.
  const [semCoef] = prazosDeRenda([renda({ rendaSugerida: null })], "2026-10-03", "2027-01-31");
  assert.equal(semCoef.euros, null);
  assert.equal(semCoef.confianca, "assumido");
}

// E. A janela atravessa o fim do ano e vem por ordem de data.
{
  const a = construirAgenda({ hoje: "2026-10-03", dias: 240, rendas: [renda({})], aimi: [] });
  assert.deepEqual(
    a.map((p) => p.id),
    ["renda-c1-2026-12-01", "imi-3-2026", "imi-1-2027"],
  );
  const datas = a.map((p) => p.data);
  assert.deepEqual(datas, [...datas].sort());
}

console.log("agenda.check.ts: OK (A, B, C, D, E)");
