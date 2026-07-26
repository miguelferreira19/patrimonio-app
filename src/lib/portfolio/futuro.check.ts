// Self-check de futuro.ts. Correr com `npm run check:futuro`.
//
// O caso B é uma nota importante: este modelo NUNCA dá p̂ = 1 exato, de propósito (risk.ts
// nunca deixa o posterior chegar a um extremo — "dois meses não fazem ninguém" é a mesma
// lógica que impede "600 meses perfeitos" de virar certeza absoluta). Por isso o caso pedido
// ("com p̂ = 1, esperado === contratado") testa-se aqui como CONVERGÊNCIA: um histórico
// extremo e perfeito empurra p̂ para muito perto de 1 e o esperado para muito perto do
// contratado, dentro de uma tolerância apertada — nunca igualdade exata, porque a
// igualdade exata seria a própria app a mentir sobre a certeza que tem.

import assert from "node:assert/strict";
import { addMonthsKey, monthKeyFromDate } from "../format";
import {
  capacidadeDeInvestimento,
  projetar,
  resumoDaProjecao,
  type MesProjetado,
} from "./futuro";
import type { Contract, Expense } from "../types";
import type { PaymentLight } from "./load";

function contract(over: Partial<Contract> = {}): Contract {
  return {
    id: "c1", property_id: "p1", tenant_name: "Inquilino", tenant_nif: null,
    pf_contract_no: null, start_date: "2020-01-01", end_date: null, rent: 500,
    due_day: 1, status: "ativo", notes: null, ...over,
  };
}

function pagamento(over: Partial<PaymentLight> = {}): PaymentLight {
  return { contract_id: "c1", ref_month: "2025-01-01", amount: 500, received_date: null, ...over };
}

function despesa(over: Partial<Expense> = {}): Expense {
  return {
    id: "e1", property_id: null, landlord_id: null, expense_date: "2025-06-01",
    category: "outras", amount: 100, description: null, ...over,
  };
}

const HOJE = new Date(2026, 0, 1); // 1 jan 2026
const MES_HOJE = monthKeyFromDate(HOJE);

// A — fronteira exata: um contrato que termina a meio do horizonte conta o mês do FIM (março,
// inclusive) e deixa de contar no mês SEGUINTE (abril) — a mesma regra de contractActiveInMonth.
{
  const c = contract({ id: "a", start_date: "2020-01-01", end_date: "2026-03-31", rent: 500 });
  const proj = projetar({ contracts: [c], payments: [], hoje: HOJE, meses: 4 });

  assert.equal(proj.length, 4);
  assert.equal(proj[0].mes, "2026-01-01");
  assert.equal(proj[3].mes, "2026-04-01");

  assert.equal(proj[0].contratado, 500, "janeiro: contrato ativo");
  assert.equal(proj[1].contratado, 500, "fevereiro: contrato ativo");
  assert.equal(proj[2].contratado, 500, "marco: mes do FIM, ainda inclusive");
  assert.equal(proj[2].contratosAtivos, 1);
  assert.equal(proj[3].contratado, 0, "abril: mes SEGUINTE ao fim, ja fora");
  assert.equal(proj[3].contratosAtivos, 0);
}

// B — historico extremo e perfeito: p̂ converge para perto de 1 e o esperado converge para
// perto do contratado (nunca igualdade exata — ver nota no topo do ficheiro).
{
  const MESES_HISTORICO = 2400; // 200 anos: só para forçar a assimptota, nao um caso real
  const inicio = addMonthsKey(MES_HOJE, -MESES_HISTORICO);
  const c = contract({ id: "b", start_date: inicio, end_date: null, rent: 1000 });
  const payments: PaymentLight[] = Array.from({ length: MESES_HISTORICO }, (_, i) =>
    pagamento({ contract_id: "b", ref_month: addMonthsKey(inicio, i), amount: 1000 }),
  );

  const proj = projetar({ contracts: [c], payments, hoje: HOJE, meses: 1 });
  const [mes] = proj;

  assert.ok(mes.esperado < mes.contratado, "nunca certeza absoluta: esperado sempre < contratado");
  assert.ok(
    mes.contratado - mes.esperado < mes.contratado * 0.001,
    `com 200 anos de historico perfeito o esperado (${mes.esperado}) devia estar a menos de 0.1% do contratado (${mes.contratado})`,
  );
}

// C — horizonte sem contratos ativos: zeros em tudo, sem NaN nem divisao por zero.
{
  const proj = projetar({ contracts: [], payments: [], hoje: HOJE, meses: 24 });
  assert.equal(proj.length, 24);
  for (const m of proj) {
    assert.equal(m.contratado, 0);
    assert.equal(m.esperado, 0);
    assert.equal(m.p10, 0);
    assert.equal(m.p90, 0);
    assert.equal(m.contratosAtivos, 0);
    assert.ok(!Number.isNaN(m.esperado) && !Number.isNaN(m.p10) && !Number.isNaN(m.p90));
  }

  const resumo = resumoDaProjecao(proj);
  assert.equal(resumo.total, 0);
  assert.equal(resumo.mediaMensal, 0);
  assert.equal(resumo.quedaContratada, 0, "sem contratos nao ha queda nenhuma");

  const cap = capacidadeDeInvestimento({ projecao: proj, expenses: [], hoje: HOJE });
  assert.equal(cap.receita24m, 0);
  assert.equal(cap.despesasConhecidas, false);
  assert.equal(cap.liquido24m, null);
}

// D — p10 <= esperado <= p90 em TODOS os meses, numa carteira realista e heterogenea
// (inquilinos bons, maus e sem historico nenhum). E uma propriedade estrutural de pPagar
// (lo <= p <= hi) que a soma com pesos >= 0 (a renda) tem de preservar; este teste e a
// rede de seguranca contra um erro de sinal na soma.
{
  const START = addMonthsKey(MES_HOJE, -24);
  const historico = (id: string, liquidados: number) => {
    const out: PaymentLight[] = [];
    for (let i = 0; i < 24; i++) {
      const paga = i < liquidados;
      out.push(pagamento({ contract_id: id, ref_month: addMonthsKey(START, i), amount: paga ? 400 : 0 }));
    }
    return out;
  };

  const contracts = [
    contract({ id: "bom", start_date: START, rent: 400 }),
    contract({ id: "mediano", start_date: START, rent: 350 }),
    contract({ id: "mau", start_date: START, rent: 300 }),
    contract({ id: "semhistorico", start_date: MES_HOJE, rent: 500 }), // comeca so agora
  ];
  const payments = [
    ...historico("bom", 24),
    ...historico("mediano", 18),
    ...historico("mau", 6),
  ];

  const proj = projetar({ contracts, payments, hoje: HOJE, meses: 24 });
  assert.equal(proj.length, 24);
  const EPS = 1e-9;
  for (const m of proj) {
    assert.ok(m.p10 <= m.esperado + EPS, `mes ${m.mes}: p10 (${m.p10}) <= esperado (${m.esperado})`);
    assert.ok(m.esperado <= m.p90 + EPS, `mes ${m.mes}: esperado (${m.esperado}) <= p90 (${m.p90})`);
  }
  // sanidade: ha substancia nos numeros (nao e tudo zero por engano de fronteira).
  assert.ok(proj.some((m) => m.esperado > 0), "a projecao tem de ter alguma receita esperada");
}

// E — sem despesas conhecidas: a app declara que nao sabe, nao inventa "liquido".
{
  const proj: MesProjetado[] = projetar({
    contracts: [contract({ id: "a", rent: 500 })],
    payments: [],
    hoje: HOJE,
    meses: 24,
  });
  const cap = capacidadeDeInvestimento({ projecao: proj, expenses: [], hoje: HOJE });
  assert.equal(cap.despesasConhecidas, false, "tabela expenses vazia: nao ha despesas conhecidas");
  assert.equal(cap.despesas24m, null);
  assert.equal(cap.liquido24m, null);
  assert.ok(cap.receita24m > 0, "a receita continua a mostrar-se mesmo sem despesas");
}

// F — com despesas registadas (>= 3 nos ultimos 12 meses), a capacidade de investimento
// vem como numero: media mensal x meses da projecao, e o liquido e a diferenca real.
{
  const proj = projetar({
    contracts: [contract({ id: "a", rent: 500 })],
    payments: [],
    hoje: HOJE,
    meses: 24,
  });
  const expenses: Expense[] = [
    despesa({ id: "e1", expense_date: "2025-03-01", amount: 200 }),
    despesa({ id: "e2", expense_date: "2025-06-01", amount: 300 }),
    despesa({ id: "e3", expense_date: "2025-11-01", amount: 100 }),
  ];
  const cap = capacidadeDeInvestimento({ projecao: proj, expenses, hoje: HOJE });
  assert.equal(cap.despesasConhecidas, true);
  assert.ok(cap.despesas24m !== null && cap.liquido24m !== null);
  const mediaMensalEsperada = (200 + 300 + 100) / 12;
  assert.equal(cap.despesas24m, mediaMensalEsperada * proj.length);
  assert.equal(cap.liquido24m, cap.receita24m - cap.despesas24m!);
}

console.log("futuro.check.ts: OK (A, B, C, D, E, F)");
