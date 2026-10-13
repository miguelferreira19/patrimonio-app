// Self-check de rentabilidade.ts. Corre com `npm run check`.
import assert from "node:assert/strict";
import { rentabilidade } from "./rentabilidade";
import { lastMonthsKeys } from "../format";
import type { Contract, Expense, Property } from "../types";

function property(id: string, matriz: string, name: string): Property {
  return {
    id, name, address: "Rua das Flores, 68", postal_code: null, municipality: null, parish: null,
    dicofre: null, typology: "T2", area_m2: null, vpt: null, vpt_year: null, matriz_article: matriz,
    status: "arrendado", notes: null,
  };
}
function contract(id: string, property_id: string, start: string, end: string | null = null): Contract {
  return {
    id, property_id, tenant_name: id, tenant_nif: null, pf_contract_no: null, start_date: start,
    end_date: end, rent: 500, due_day: 1, status: end ? "cessado" : "ativo", notes: null,
  };
}
const recibo = (property_id: string, mes: string, amount = 500, cancelled = false) => ({ property_id, ref_month: mes, amount, cancelled });
const despesa = (property_id: string, data: string, category: Expense["category"], amount: number) => ({
  property_id, expense_date: data, category, amount,
});

const FIM = "2026-07-01"; // janela: ago 2025 a jul 2026

const r = rentabilidade({
  fim: FIM,
  ativos: [
    // A e B no mesmo prédio (artigo 5077); C isolada.
    { property: property("A", "182341-U-5077-A", "RCDTO"), contracts: [contract("ca", "A", "2020-01-01")], valor: 100_000 },
    { property: property("B", "182341-U-5077-B", "RCESQ"), contracts: [contract("cb", "B", "2026-02-01")], valor: 100_000 },
    { property: property("C", "182341-U-9000", "Casa Toneca"), contracts: [contract("cc", "C", "2020-01-01")], valor: null },
  ],
  recibos: [
    ...lastMonthsKeys(12, FIM).map((m) => recibo("A", m)),
    recibo("A", "2025-07-01"), // fora da janela
    recibo("B", "2026-03-01"),
    recibo("B", "2026-04-01", 500, true), // anulado
    recibo("C", "2026-01-01", 300),
  ],
  despesas: [
    despesa("A", "2025-12-31", "imi", 200),
    despesa("A", "2025-12-31", "conservacao", 3_000), // obras: 1/3 por ano
    despesa("A", "2024-12-31", "imi", 999), // fora da janela
    despesa("C", "2025-12-31", "condominio", 1_000),
  ],
});

const A = r.fracoes.find((l) => l.property.id === "A")!;
assert.equal(A.renda, 6_000, "12 recibos da janela, o de julho de 2025 fica de fora");
assert.equal(A.mesesPagos, 12);
assert.equal(A.custos, 200 + 1_000, "IMI do ano + obras a 1/3");
assert.equal(A.resultado, 4_800);
assert.equal(A.rendimento, 0.048);

const B = r.fracoes.find((l) => l.property.id === "B")!;
assert.equal(B.renda, 500, "o recibo anulado não conta");
assert.equal(B.mesesVagos, 6, "ago a jan sem contrato");

const C = r.fracoes.find((l) => l.property.id === "C")!;
assert.equal(C.resultado, -700, "uma fração pode dar prejuízo");
assert.equal(C.rendimento, null, "sem valor estimado não há rendimento");

assert.deepEqual(r.fracoes.map((l) => l.property.id), ["A", "B", "C"], "do maior resultado para o menor");
assert.equal(r.predios.length, 2, "A e B são o mesmo prédio");
const predio = r.predios[0];
assert.equal(predio.resultado, 4_800 + 500);
assert.equal(predio.valor, 200_000);
assert.equal(r.totais.resultado, 4_800 + 500 - 700);
assert.equal(r.totais.rendimento, (4_800 + 500) / 200_000, "só sobre as frações com valor");

console.log("rentabilidade.check.ts: OK");
