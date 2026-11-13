import assert from "node:assert/strict";
import {
  diarioDoInquilino, promessasPorCumprir, ultimoContacto,
  type EventoDoDiario, type FontesDoDiario,
} from "./diario";
import { carregarFontesDoDiario } from "./diario-load";

const hoje = "2026-11-13";
const evento = (
  id: string, kind: FontesDoDiario["eventos"][number]["kind"],
  over: Partial<FontesDoDiario["eventos"][number]> = {},
): FontesDoDiario["eventos"][number] => ({
  id, contract_id: "c1", kind, occurred_on: "2026-11-01", note: id,
  due_date: null, autor: null, ...over,
});
const movimento = (
  id: string, over: Partial<FontesDoDiario["movimentos"][number]> = {},
): FontesDoDiario["movimentos"][number] => ({
  id, contract_id: "c1", received_date: "2026-11-01", created_at: "2026-11-02T10:00:00Z",
  amount: 300, notes: null, voided: false, autor: "Gestor", ...over,
});
const recibo = (
  id: string, over: Partial<FontesDoDiario["recibos"][number]> = {},
): FontesDoDiario["recibos"][number] => ({
  id, contract_id: "c1", issue_date: "2026-11-01", receipt_number: "contrato/1",
  amount: 400, withholding: 100, cancelled: false, ...over,
});

{
  const fontes: FontesDoDiario = {
    eventos: [evento("nota", "nota"), evento("carta", "carta"),
      evento("contacto", "contacto", { autor: "Ana" }),
      evento("promessa", "promessa", { due_date: "2026-11-05", amount: 300 }),
      evento("antigo", "nota", { occurred_on: "2026-10-31" }),
      evento("novo", "nota", { occurred_on: "2026-11-02" }),
      evento("fora", "contacto", { contract_id: "c2" })],
    movimentos: [movimento("pagamento"), movimento("anulado", { voided: true }),
      movimento("fora", { contract_id: "c2" })],
    recibos: [recibo("recibo"), recibo("anulado", { cancelled: true }),
      recibo("fora", { contract_id: "c2" }), recibo("orfao", { contract_id: null })],
  };
  const original = structuredClone(fontes);
  const diario = diarioDoInquilino(["c1"], fontes);
  assert.deepEqual(diario.map((e) => e.id),
    ["novo", "promessa", "contacto", "carta", "nota", "pagamento", "recibo", "antigo"]);
  assert.deepEqual(fontes, original, "não altera as fontes");
  assert.equal(diario.find((e) => e.id === "promessa")?.prometidoPara, "2026-11-05");
  assert.equal(diario.find((e) => e.id === "promessa")?.valor, 300);
  assert.equal(diario.find((e) => e.id === "contacto")?.autor, "Ana");
  assert.equal(diario.find((e) => e.id === "nota")?.autor, null);
  assert.equal(diario.find((e) => e.id === "recibo")?.autor, "Portal das Finanças");
  assert.equal(diario.find((e) => e.id === "recibo")?.valor, 300, "valor líquido");
  assert.equal(diario.find((e) => e.id === "pagamento")?.valor, 300);
  assert.deepEqual(diarioDoInquilino([], fontes), []);
}

{
  const diario = diarioDoInquilino(["c1"], {
    eventos: [evento("visita", "visita"), evento("acordo", "acordo", { occurred_on: "2026-11-02" }),
      evento("promessa", "promessa"), evento("nota", "nota", { occurred_on: "2026-11-03" })],
    movimentos: [movimento("sem-data", { received_date: null })],
    recibos: [recibo("sem-data", { issue_date: null })],
  });
  assert.equal(diario.find((e) => e.id === "visita")?.tipo, "contacto");
  assert.equal(diario.find((e) => e.id === "acordo")?.tipo, "contacto");
  assert.equal(diario.find((e) => e.id === "promessa")?.valor, undefined, "schema anterior sem amount");
  assert.equal(diario.find((e) => e.tipo === "pagamento")?.dia, "2026-11-02");
  assert.equal(diario.some((e) => e.tipo === "recibo"), false, "não inventa uma data de emissão");
  assert.equal(ultimoContacto([...diario].reverse())?.id, "acordo");
  assert.equal(ultimoContacto(diario.filter((e) => e.tipo === "nota")), null);
  assert.equal(ultimoContacto([]), null);
}

{
  const promessa: EventoDoDiario = {
    id: "p", contratoId: "c1", dia: "2026-11-01", tipo: "promessa", texto: "Pagarei",
    autor: null, prometidoPara: "2026-11-05", valor: 300,
  };
  const pagamento: EventoDoDiario = {
    id: "r", contratoId: "c1", dia: "2026-11-06", tipo: "recibo", texto: "Recibo",
    autor: "Portal das Finanças", valor: 1,
  };
  assert.deepEqual(promessasPorCumprir([promessa], hoje), [promessa]);
  for (const tipo of ["pagamento", "recibo"] as const) {
    assert.deepEqual(promessasPorCumprir([promessa, { ...pagamento, tipo }], hoje), []);
    assert.deepEqual(promessasPorCumprir([promessa, { ...pagamento, tipo, dia: promessa.dia }], hoje), []);
  }
  assert.deepEqual(promessasPorCumprir([promessa, { ...pagamento, contratoId: "c2" }], hoje), [promessa]);
  assert.deepEqual(promessasPorCumprir([promessa, { ...pagamento, dia: "2026-10-31" }], hoje), [promessa]);
  assert.deepEqual(promessasPorCumprir([{ ...promessa, prometidoPara: "2026-11-14" }], hoje), []);
  assert.deepEqual(promessasPorCumprir([{ ...promessa, prometidoPara: hoje }], hoje), []);
  assert.deepEqual(promessasPorCumprir([{ ...promessa, prometidoPara: undefined }], hoje), []);
}

console.log("diario.check.ts: OK (ordem, fontes, anulados, promessas e contacto)");

type Registo = Record<string, unknown>;
type Pedido = { tabela: string; selecao: string; inicio: number; fim: number };
class BaseFalsa {
  pedidos: Pedido[] = [];
  falharEm: string | null = null;
  constructor(public tabelas: Record<string, Registo[]>) {}
  from(tabela: string) { return new ConsultaFalsa(this, tabela); }
}
class ConsultaFalsa {
  selecao = "";
  filtros: Array<{ coluna: string; ids: string[] }> = [];
  constructor(private base: BaseFalsa, private tabela: string) {}
  select(colunas: string) { this.selecao = colunas; return this; }
  in(coluna: string, ids: string[]) { this.filtros.push({ coluna, ids }); return this; }
  order() { return this; }
  async range(inicio: number, fim: number) {
    this.base.pedidos.push({ tabela: this.tabela, selecao: this.selecao, inicio, fim });
    if (this.base.falharEm === this.tabela) return { data: null, error: { message: "falha sintética" } };
    const dados = (this.base.tabelas[this.tabela] ?? []).filter((r) =>
      this.filtros.every((f) => f.ids.includes(r[f.coluna] as string)));
    return { data: dados.slice(inicio, fim + 1), error: null };
  }
}
const cliente = (base: BaseFalsa) => base as unknown as Parameters<typeof carregarFontesDoDiario>[0];

async function verificarLoader() {
  const base = new BaseFalsa({
    management_cases: [{ id: "caso1", contract_id: "c1" }, { id: "caso2", contract_id: "c2" }],
    management_events: [
      ...Array.from({ length: 1001 }, (_, i) => ({
        id: `e${i}`, case_id: "caso1", kind: "nota", occurred_on: "2026-11-01", note: "Nota",
        due_date: null, created_by: i === 0 ? "p1" : null,
      })),
      { id: "outro", case_id: "caso2", created_by: "p2", kind: "promessa", amount: 100 },
    ],
    payment_movements: [{ ...movimento("m1"), created_by: "p2" },
      { ...movimento("m2", { contract_id: "c2" }), created_by: "ausente" }],
    receipts: [recibo("r1"), recibo("r2", { contract_id: "c2" })],
    profiles: [{ id: "p1", display_name: " Ana ", email: "ana@example.test" },
      { id: "p2", display_name: " ", email: "bruno@example.test" }],
  });
  const fontes = await carregarFontesDoDiario(cliente(base));
  assert.equal(fontes.eventos.length, 1002, "paginação de eventos sem perder a segunda página");
  assert.equal(fontes.eventos[0].autor, "Ana");
  assert.equal(fontes.eventos[0].amount, undefined, "coluna amount ainda ausente");
  assert.equal(fontes.eventos.at(-1)?.contract_id, "c2");
  assert.equal(fontes.eventos.at(-1)?.autor, "bruno");
  assert.deepEqual(fontes.movimentos.map((m) => m.autor), ["bruno", null]);
  assert.deepEqual(fontes.recibos, []);
  assert.equal(base.pedidos.some((p) => p.tabela === "receipts"), false);
  assert.ok(base.pedidos.filter((p) => p.tabela === "management_events").every((p) => p.selecao === "*"));
  const filtradas = await carregarFontesDoDiario(cliente(base), ["c1"]);
  assert.equal(filtradas.eventos.length, 1001);
  assert.ok(filtradas.eventos.every((e) => e.contract_id === "c1"));
  assert.equal(filtradas.movimentos.length, 1);
  assert.deepEqual(filtradas.recibos.map((r) => r.id), ["r1"]);
  const vazia = new BaseFalsa({});
  assert.deepEqual(await carregarFontesDoDiario(cliente(vazia), []), { eventos: [], movimentos: [], recibos: [] });
  assert.deepEqual(vazia.pedidos, []);
  for (const tabela of ["management_cases", "management_events", "payment_movements", "profiles", "receipts"]) {
    base.falharEm = tabela;
    await assert.rejects(carregarFontesDoDiario(cliente(base), ["c1"]), new RegExp(tabela));
  }
  console.log("diario.check.ts: OK (loader simulado, filtros, paginação, autores e erros)");
}
void verificarLoader();
