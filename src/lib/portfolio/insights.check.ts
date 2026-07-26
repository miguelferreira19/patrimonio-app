// Self-check de insights.ts. Correr com `npm run check:insights`.
// ponytail: um só check, no que é não-trivial — o gate de materialidade, a separação dos
// valores assumidos e a ordem. Os geradores em si são leituras do snapshot já testado.
import assert from "node:assert/strict";
import { buildSnapshot } from "./snapshot";
import { LIMIAR_ANUAL_EUR, agrupar, construirFila } from "./insights";
import type { RawData } from "./load";
import type { Contract, Payment, Property } from "../types";

const TODAY = new Date(2026, 6, 20);

function prop(over: Partial<Property>): Property {
  return {
    id: "p", name: "Fração", address: null, postal_code: null, municipality: null, parish: null,
    dicofre: null, typology: "T2", area_m2: 64, vpt: 50_000, vpt_year: 2020,
    matriz_article: null, status: "arrendado", notes: null, ...over,
  };
}
function contr(over: Partial<Contract>): Contract {
  return {
    id: "c", property_id: "p", tenant_name: "Inquilino", tenant_nif: null, pf_contract_no: null,
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

// c1 em dia; c2 parou em abril (2 meses); c3 parou em marco (3 meses).
const pagamentos: Payment[] = [
  ...pays("c1", "2024-01-01", "2026-06-01", 400),
  ...pays("c2", "2024-01-01", "2026-04-01", 250),
  ...pays("c3", "2024-01-01", "2026-03-01", 300),
];

const raw: RawData = {
  properties: [prop({ id: "p1", name: "Flores" }), prop({ id: "p2", name: "Sé" }), prop({ id: "p3", name: "Repeses" })],
  contracts: [
    contr({ id: "c1", property_id: "p1", rent: 400 }),
    contr({ id: "c2", property_id: "p2", rent: 250 }),
    contr({ id: "c3", property_id: "p3", rent: 300 }),
  ],
  owners: [
    { property_id: "p1", landlord_id: "L1", quota: 100 },
    { property_id: "p2", landlord_id: "L1", quota: 100 },
    { property_id: "p3", landlord_id: "L1", quota: 100 },
  ],
  landlords: [{ id: "L1", name: "António", nif: null, notes: null }],
  benchmarks: [],
  // c1 em dia até junho; c2 parou em abril -> 2 meses de atraso (500 EUR).
  payments: pagamentos,
  expenses: [],
  rentUpdates: [],
  coefficients: [],
  // os fixtures usam linhas completas, logo servem para os dois campos
  // sem retencao nos fixtures, logo os recibos valem o mesmo que os pagamentos
  receiptsRecentes: pagamentos,
  paymentsRecentes: pagamentos,
  historicoCarregado: true,
  receiptsThisMonth: [], // nenhum recibo de julho emitido
  orphanReceipts: 0,
  insightState: [],
};

const snap = buildSnapshot(raw, TODAY);
const fila = construirFila(snap);

// A — o gate de materialidade separa, não esconde.
{
  assert.ok(
    fila.itens.every((i) => i.euros >= LIMIAR_ANUAL_EUR),
    "nenhum item na fila abaixo do limiar",
  );
  const todos = fila.itens.length + fila.residuais.n;
  assert.ok(todos > 0, "há sinais");
  assert.ok(fila.residuais.n >= 0);
}

// B — ordem por valor decrescente: a fila é uma priorização, não uma lista.
{
  const euros = fila.itens.map((i) => i.euros);
  assert.deepEqual(euros, euros.slice().sort((a, b) => b - a), "ordenada por euros desc");
}

// C — os valores ASSUMIDOS não entram na linha de dinheiro do topo (risco C3 do PLANO.md:
// prometer euros que dependem de uma premissa não confirmada destrói a confiança de uma vez).
{
  const assumidos = fila.itens.filter((i) => i.confianca === "assumido");
  assert.equal(
    fila.totalAssumido,
    assumidos.reduce((a, i) => a + i.euros, 0),
    "assumidos somados à parte",
  );
  assert.equal(
    fila.total,
    fila.itens.filter((i) => i.confianca !== "assumido").reduce((a, i) => a + i.euros, 0),
    "total só com medido e estimado",
  );
}

// D — um gerador end-to-end: sem recibos emitidos, a checklist do mês vale a soma das rendas.
{
  const recibos = fila.itens.find((i) => i.kind === "recibo_por_emitir");
  assert.ok(recibos, "há item de recibos por emitir");
  assert.equal(recibos.euros, 400 + 250 + 300, "soma das rendas dos contratos ativos");
  assert.equal(recibos.grupo, "fazer");
  assert.ok(recibos.acoes.some((a) => a.externo), "leva ao Portal");
}

// E — os atrasos vêm AGREGADOS num só item (risco C1 do PLANO.md: com os dados reais,
// um item por contrato dava 18 linhas e a fila deixava de priorizar nada). O detalhe
// contrato a contrato vive na lente Risco da Carteira (era /atrasos antes da Fase 3).
{
  const atrasos = fila.itens.filter((i) => i.kind === "atraso");
  assert.equal(atrasos.length, 1, "dois contratos em atraso, UM item na fila");
  // Fase 4: o valor da fila passou a ser a PERDA ESPERADA. Nunca acima da dívida
  // ingénua (2x250 + 3x300 = 1400) e, nos fixtures, estritamente abaixo — os inquilinos
  // têm histórico de liquidação, logo p̂ desconta.
  assert.ok(atrasos[0].euros > 0, "há perda esperada");
  assert.ok(atrasos[0].euros <= 500 + 900, "perda esperada nunca acima da dívida ingénua");
  assert.ok(atrasos[0].conta?.includes("cura"), "a conta mostra a formula da perda esperada");
  assert.ok(
    /soma crua dos meses em falta daria/.test(atrasos[0].conta ?? ""),
    "e a estimativa ingenua ao lado",
  );
  assert.ok(atrasos[0].porque.includes("Repeses"), "nomeia os maiores");

  assert.ok(
    atrasos[0].acoes.some((a) => a.href.startsWith("/carteira?lente=risco")),
    "leva ao detalhe (lente Risco)",
  );
}

// E2 — o teste de aceitação da Fase 2: a fila tem de caber num ecrã. Qualquer gerador que
// passe a emitir um item por entidade rebenta aqui antes de chegar a produção.
{
  assert.ok(fila.itens.length <= 8, `fila com ${fila.itens.length} itens, máximo 8`);
}

// F — todo o item tem ação e conta. Um item sem ação é informação, e informação não
// pertence à fila (PLANO.md §4, regra 3).
{
  for (const i of fila.itens) {
    assert.ok(i.acoes.length > 0, `${i.kind} tem pelo menos uma ação`);
    assert.ok(i.porque.length > 0, `${i.kind} explica o porquê`);
    assert.ok(i.titulo.length > 0, `${i.kind} tem título`);
  }
}

// G — agrupar não perde nem duplica itens.
{
  const grupos = agrupar(fila.itens);
  const total = grupos.reduce((a, g) => a + g.itens.length, 0);
  assert.equal(total, fila.itens.length, "agrupamento preserva a contagem");
}

// H — S3: adiar esconde, dispensar esconde, adiar com data passada NÃO esconde.
// A prova de que o estado filtra a fila sem apagar o facto: o gerador continua a correr,
// o item aparece em `silenciadas` com a mesma soma de euros.
{
  const alvo = fila.itens[0];
  assert.ok(alvo, "há pelo menos um item para silenciar");
  const chave = { kind: alvo.kind, subject: alvo.subject ?? "" };

  const comAdiar = construirFila(
    buildSnapshot(
      { ...raw, insightState: [{ ...chave, snoozed_until: "2026-12-31", dismissed_at: null, note: null, updated_at: "" }] },
      TODAY,
    ),
  );
  assert.ok(
    !comAdiar.itens.some((i) => i.kind === alvo.kind),
    "item adiado sai da fila",
  );
  assert.equal(comAdiar.silenciadas.length, 1, "e aparece em silenciadas");
  assert.ok(comAdiar.total < fila.total, "e deixa de somar no numero de topo");

  const comExpirado = construirFila(
    buildSnapshot(
      { ...raw, insightState: [{ ...chave, snoozed_until: "2020-01-01", dismissed_at: null, note: null, updated_at: "" }] },
      TODAY,
    ),
  );
  assert.ok(
    comExpirado.itens.some((i) => i.kind === alvo.kind),
    "adiamento expirado volta a mostrar o item",
  );

  const comDispensar = construirFila(
    buildSnapshot(
      { ...raw, insightState: [{ ...chave, snoozed_until: null, dismissed_at: "2026-07-01T00:00:00Z", note: null, updated_at: "" }] },
      TODAY,
    ),
  );
  assert.ok(
    !comDispensar.itens.some((i) => i.kind === alvo.kind),
    "item dispensado sai da fila",
  );
  assert.ok(comDispensar.silenciadas[0].dispensada, "e fica marcado como dispensado");
}

console.log("insights.check.ts: OK (A, B, C, D, E, F, G, H)");
