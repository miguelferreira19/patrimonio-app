// Self-check de conselhos.ts. Corre com `npm run check`.
import assert from "node:assert/strict";
import { buildSnapshot } from "./snapshot";
import { LIMIAR_CONSELHO_EUR, construirConselhos } from "./conselhos";
import type { EntradaConselhos } from "./conselhos";
import type { Concentracao, RendaParada } from "./renda";
import type { CapacidadeDeInvestimento, MesProjetado, ResumoDaProjecao } from "./futuro";
import type { RawData } from "./load";
import type { Contract, MarketBenchmark, Payment, Property } from "../types";

const TODAY = new Date(2026, 6, 20);

function prop(over: Partial<Property> & { id: string }): Property {
  return {
    name: "Fração", address: null, postal_code: null, municipality: null, parish: null,
    dicofre: null, typology: "T2", area_m2: null, vpt: 50_000, vpt_year: 2020,
    matriz_article: null, status: "arrendado", notes: null, ...over,
  };
}
function contr(over: Partial<Contract> & { id: string; property_id: string }): Contract {
  return {
    tenant_name: "Inquilino", tenant_nif: null, pf_contract_no: null,
    start_date: "2015-01-01", end_date: null, rent: 400, due_day: 1, status: "ativo",
    notes: null, ...over,
  };
}
function pays(id: string, de: string, ate: string, v: number): Payment[] {
  const out: Payment[] = [];
  let m = de;
  while (m <= ate) {
    out.push({ id: `${id}${m}`, contract_id: id, ref_month: m, amount: v,
      received_date: m, method: "transferencia", source: "recibo", notes: null });
    const y = +m.slice(0, 4), mm = +m.slice(5, 7);
    m = mm === 12 ? `${y + 1}-01-01` : `${y}-${String(mm + 1).padStart(2, "0")}-01`;
  }
  return out;
}
function bench(over: Partial<MarketBenchmark> & { id: string; dicofre: string }): MarketBenchmark {
  return {
    parish_name: null, municipality: null, period: "2025", rent_median_m2: null,
    sale_median_m2: null, level: "concelho", source: "INE", ...over,
  };
}

/** Uma carteira base "morna": três frações arrendadas em dia, sem área preenchida, sem
 *  contrato a terminar em breve. Serve às secções que testam UM gerador de cada vez sem
 *  os outros a meterem ruído na lista. */
function rawBase(): RawData {
  const contracts = [
    contr({ id: "c1", property_id: "p1", rent: 400 }),
    contr({ id: "c2", property_id: "p2", rent: 300 }),
    contr({ id: "c3", property_id: "p3", rent: 350 }),
  ];
  const payments = [
    ...pays("c1", "2024-01-01", "2026-06-01", 400),
    ...pays("c2", "2024-01-01", "2026-06-01", 300),
    ...pays("c3", "2024-01-01", "2026-06-01", 350),
  ];
  return {
    properties: [prop({ id: "p1" }), prop({ id: "p2" }), prop({ id: "p3" })],
    contracts,
    owners: [
      { property_id: "p1", landlord_id: "L1", quota: 100 },
      { property_id: "p2", landlord_id: "L1", quota: 100 },
      { property_id: "p3", landlord_id: "L1", quota: 100 },
    ],
    landlords: [{ id: "L1", name: "António", nif: null, notes: null }],
    benchmarks: [],
    payments,
    expenses: [],
    rentUpdates: [],
    coefficients: [],
    receiptsRecentes: payments,
    paymentsRecentes: payments,
    historicoCarregado: true,
    receiptsThisMonth: [],
    orphanReceipts: 0,
    insightState: [],
  };
}

/** Uma `CapacidadeDeInvestimento`/`ResumoDaProjecao`/`MesProjetado[]` neutras, para as
 *  secções que não testam a projeção em si (evita repetir `projetar()` em todo o lado). */
function projecaoNeutra(): MesProjetado[] {
  return [{ mes: "2026-08-01", contratado: 1000, esperado: 900, p10: 800, p90: 950, contratosAtivos: 3 }];
}
function capacidadeNeutra(): CapacidadeDeInvestimento {
  return { receita24m: 0, despesas24m: null, liquido24m: null, despesasConhecidas: false, despesasEspelhadas: false };
}
function resumoNeutro(): ResumoDaProjecao {
  return { total: 0, totalP10: 0, totalP90: 0, mediaMensal: 0, quedaContratada: 0 };
}
function concentracaoNeutra(): Concentracao {
  return { porInquilino: [], porFracao: [], hhi: 0, agrupadosPorNome: 0 };
}

function entradaBase(overrides: Partial<EntradaConselhos> = {}): EntradaConselhos {
  return {
    snap: buildSnapshot(rawBase(), TODAY),
    projecao: projecaoNeutra(),
    capacidade: capacidadeNeutra(),
    resumo: resumoNeutro(),
    concentracao: concentracaoNeutra(),
    rendasParadas: [],
    hoje: TODAY,
    ...overrides,
  };
}

// A — inquilino com 40% da receita gera conselho; com 5% não gera.
{
  const alta: Concentracao = {
    porInquilino: [{ chave: "nif:123456789", nome: "Grande Inquilino Lda", recebido12m: 8000, quota: 0.4 }],
    porFracao: [],
    hhi: 0.16,
    agrupadosPorNome: 0,
  };
  const conselhosAlta = construirConselhos(entradaBase({ concentracao: alta }));
  const itemAlta = conselhosAlta.find((c) => c.kind === "concentracao_inquilino");
  assert.ok(itemAlta, "40% de um só inquilino gera conselho");
  assert.equal(itemAlta!.euros, 8000, "euros = recebido12m do inquilino no topo");
  assert.equal(itemAlta!.confianca, "medido", "agrupado por NIF: confianca medido");

  const baixa: Concentracao = {
    porInquilino: [{ chave: "nif:999999999", nome: "Inquilino Pequeno", recebido12m: 500, quota: 0.05 }],
    porFracao: [],
    hhi: 0.0025,
    agrupadosPorNome: 0,
  };
  const conselhosBaixa = construirConselhos(entradaBase({ concentracao: baixa }));
  assert.ok(
    !conselhosBaixa.some((c) => c.kind === "concentracao_inquilino"),
    "5% de um so inquilino nao gera conselho",
  );
}

// A2 — sem NIF (agrupado por nome), a confianca desce para estimado e a conta avisa do
// risco de homonimos.
{
  const porNome: Concentracao = {
    porInquilino: [{ chave: "nome:familia silva", nome: "Familia Silva", recebido12m: 6000, quota: 0.35 }],
    porFracao: [],
    hhi: 0.12,
    agrupadosPorNome: 2,
  };
  const conselhos = construirConselhos(entradaBase({ concentracao: porNome }));
  const item = conselhos.find((c) => c.kind === "concentracao_inquilino");
  assert.ok(item, "concentracao por nome tambem gera conselho");
  assert.equal(item!.confianca, "estimado", "sem NIF: confianca estimado");
  assert.ok(item!.conta?.includes("homónimos"), "a conta avisa do risco de homonimos");
}

// B, C, D — os conselhos que ordenavam património ao lado de rendimento saíram (13/10/2026,
// PLANO_CLAREZA.md 3.5): "capacidade de investimento", "rever o yield" e "rever a venda".
// Uma carteira COM yields baixos e com capacidade material já não os gera.
{
  const raw: RawData = {
    ...rawBase(),
    properties: [
      prop({ id: "baixo", dicofre: "0101", area_m2: 100 }),
      prop({ id: "alto", dicofre: "0101", area_m2: 100 }),
    ],
    contracts: [
      contr({ id: "cb", property_id: "baixo", rent: 500 }),
      contr({ id: "ca", property_id: "alto", rent: 1500 }),
    ],
    benchmarks: [bench({ id: "b1", dicofre: "0101", sale_median_m2: 2000 })],
    payments: [...pays("cb", "2024-01-01", "2026-06-01", 500), ...pays("ca", "2024-01-01", "2026-06-01", 1500)],
    receiptsRecentes: [],
    paymentsRecentes: [],
  };
  const snap = buildSnapshot(raw, TODAY);
  const capacidade: CapacidadeDeInvestimento = {
    receita24m: 50_000, despesas24m: 10_000, liquido24m: 40_000, despesasConhecidas: true, despesasEspelhadas: false,
  };
  const conselhos = construirConselhos(entradaBase({ snap, capacidade, projecao: projecaoNeutra() }));
  for (const kind of ["capacidade_investir", "yield_baixo", "candidato_venda"]) {
    assert.ok(!conselhos.some((c) => c.kind === kind), `${kind} já não é um conselho`);
  }
}

// E — conselhos abaixo do limiar de materialidade não aparecem.
{
  const paradasPequenas: RendaParada[] = [
    { contractId: "c1", tenant: "Inquilino", rendaAtual: 400, mesesSemAtualizar: 30, rendaSugerida: 420, ganhoAnual: 100 },
  ];
  assert.ok(100 < LIMIAR_CONSELHO_EUR, "o fixture tem de estar mesmo abaixo do limiar");
  const conselhos = construirConselhos(entradaBase({ rendasParadas: paradasPequenas }));
  assert.ok(
    !conselhos.some((c) => c.kind === "renda_parada"),
    "ganho anual de 100 EUR fica abaixo do limiar de 250 e nao aparece",
  );

  // O mesmo gerador, com o dobro do numero de rendas paradas e o mesmo ganho unitario,
  // passa a ser material e aparece: prova que o corte e o VALOR, nao a existencia do sinal.
  const paradasMateriais: RendaParada[] = [
    ...paradasPequenas,
    { contractId: "c2", tenant: "Outro Inquilino", rendaAtual: 400, mesesSemAtualizar: 30, rendaSugerida: 450, ganhoAnual: 600 },
  ];
  const conselhos2 = construirConselhos(entradaBase({ rendasParadas: paradasMateriais }));
  assert.ok(
    conselhos2.some((c) => c.kind === "renda_parada"),
    "700 EUR de ganho anual agregado ja passa o limiar",
  );
}

// F — a lista devolvida está ordenada por euros decrescente.
{
  const entrada = entradaBase({
    concentracao: {
      porInquilino: [{ chave: "nif:1", nome: "Inquilino A", recebido12m: 5000, quota: 0.3 }],
      porFracao: [],
      hhi: 0.09,
      agrupadosPorNome: 0,
    },
    rendasParadas: [
      { contractId: "c1", tenant: "Inquilino B", rendaAtual: 400, mesesSemAtualizar: 30, rendaSugerida: 500, ganhoAnual: 1200 },
    ],
    resumo: { total: 0, totalP10: 0, totalP90: 0, mediaMensal: 0, quedaContratada: 500 },
  });
  const conselhos = construirConselhos(entrada);
  assert.ok(conselhos.length >= 3, "o cenario gera varios conselhos de kinds diferentes");
  const euros = conselhos.map((c) => c.euros);
  assert.deepEqual(euros, euros.slice().sort((a, b) => b - a), "ordenado por euros decrescente");
}

// G — todo o conselho tem conta, porque, titulo e pelo menos uma ação (mesma regra F do
// insights.check.ts: um item sem ação e informação, nao pertence a uma lista de decisões).
{
  const entrada = entradaBase({
    concentracao: {
      porInquilino: [{ chave: "nif:1", nome: "Inquilino A", recebido12m: 5000, quota: 0.3 }],
      porFracao: [],
      hhi: 0.09,
      agrupadosPorNome: 0,
    },
  });
  const conselhos = construirConselhos(entrada);
  assert.ok(conselhos.length > 0, "ha pelo menos um conselho para verificar");
  for (const c of conselhos) {
    assert.ok(c.conta && c.conta.length > 0, `${c.kind} tem conta`);
    assert.ok(c.porque.length > 0, `${c.kind} explica o porque`);
    assert.ok(c.titulo.length > 0, `${c.kind} tem titulo`);
    assert.ok(c.acoes.length > 0, `${c.kind} tem pelo menos uma acao`);
    assert.ok(["agora", "ano", "estrutural"].includes(c.horizonte), `${c.kind} tem horizonte valido`);
  }
}

console.log("conselhos.check.ts: OK (A, A2, BCD, E, F, G)");
