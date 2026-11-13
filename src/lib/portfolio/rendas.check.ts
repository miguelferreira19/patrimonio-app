import assert from "node:assert/strict";
import { linhasDeRendas, resumoDoMes } from "./rendas";
import { buildSnapshot, type Snapshot } from "./snapshot";
import { chaveDoInquilino } from "./inquilinos";
import { emAtrasoDaCarteira } from "./insights";
import { addMonthsKey, lastMonthsKeys } from "../format";
import type { RawData } from "./load";
import type { Contract, Payment, Property } from "../types";
import type { EventoDoDiario } from "./diario";

const HOJE = "2026-11-13";
const MES = "2026-11-01";
const FECHADOS = lastMonthsKeys(6, "2026-10-01");
function contrato(id: string, over: Partial<Contract> = {}): Contract {
  return {
    id, property_id: `p-${id}`, tenant_name: id, tenant_nif: null, pf_contract_no: null,
    start_date: "2020-01-01", end_date: null, rent: 500, due_day: 1,
    status: "ativo", notes: null, ...over,
  };
}
function propriedade(id: string): Property {
  return {
    id, name: `Fração ${id}`, address: null, postal_code: null, municipality: null,
    parish: null, dicofre: null, typology: "T2", area_m2: null, vpt: null, vpt_year: null,
    matriz_article: null, status: "arrendado", notes: null,
  };
}
function pagamentos(c: Contract): Payment[] {
  return lastMonthsKeys(13, MES).map((ref_month) => ({
    id: `${c.id}-${ref_month}`, contract_id: c.id, ref_month, amount: c.rent,
    received_date: `${ref_month.slice(0, 7)}-05`, method: "transferencia", source: "recibo", notes: null,
  }));
}
function snapshot(contratos: Contract[], pagos = contratos.flatMap(pagamentos), over: Partial<RawData> = {}): Snapshot {
  return buildSnapshot({
    properties: [...new Set(contratos.map((c) => c.property_id))].map(propriedade),
    contracts: contratos, payments: pagos, paymentsRecentes: pagos, receiptsRecentes: [],
    receiptsThisMonth: [], landlords: [], owners: [], benchmarks: [], expenses: [],
    rentUpdates: [], coefficients: [], orphanReceipts: 0, insightState: [], historicoCarregado: true,
    ...over,
  }, new Date(`${HOJE}T12:00:00Z`));
}
function linha(snap: Snapshot, c: Contract, diario: EventoDoDiario[] = []) {
  const encontrada = linhasDeRendas(snap, diario).find((l) => l.chave === chaveDoInquilino(c));
  assert.ok(encontrada);
  return encontrada;
}
const promessa = (c: Contract): EventoDoDiario => ({
  id: "promessa", contratoId: c.id, dia: "2026-11-06", tipo: "promessa", texto: "Pagarei",
  autor: null, prometidoPara: "2026-11-10",
});

{
  const snap = snapshot([]);
  assert.deepEqual(linhasDeRendas(snap, []), []);
  assert.deepEqual(resumoDoMes(snap), {
    pagas: 0, total: 0, recebido: 0, porReceber: 0, emAtraso: 0,
    inquilinosEmAtraso: 0, semInformacao: 0,
  });
  const c1 = contrato("Ana");
  const c2 = contrato("Bruno");
  const calmo = snapshot([c1, c2]);
  assert.ok(linhasDeRendas(calmo, []).every((l) => l.estado === "paga"));
  assert.deepEqual(resumoDoMes(calmo), {
    pagas: 2, total: 2, recebido: 1000, porReceber: 0, emAtraso: 0,
    inquilinosEmAtraso: 0, semInformacao: 0,
  });
  const esperado = structuredClone(calmo);
  linhasDeRendas(calmo, []);
  resumoDoMes(calmo);
  assert.deepEqual(calmo, esperado, "não altera o snapshot");
}

{
  const a = contrato("a", { tenant_name: "Ana", tenant_nif: "1" });
  const b = contrato("b", { tenant_name: "ANA", tenant_nif: "1", rent: 300 });
  const c = contrato("c", { tenant_name: "Bruno", rent: 450 });
  const pagos = [...pagamentos(a).filter((p) => p.ref_month < "2026-09-01"),
    ...pagamentos(b), ...pagamentos(c).filter((p) => p.ref_month < "2026-10-01")];
  const snap = snapshot([a, b, c], pagos);
  const linhas = linhasDeRendas(snap, [promessa(a)]);
  assert.equal(linhas.length, 2, "dois contratos do mesmo NIF dão uma linha");
  assert.equal(linha(snap, a).estado, "em_atraso");
  assert.equal(linha(snap, a).rendaMensal, 800);
  assert.equal(linha(snap, a).fracoes.length, 2);
  assert.equal(linha(snap, a).mesesEmAtraso, 2);
  assert.equal(linha(snap, a).desde, "2026-09-01");
  assert.deepEqual(linhas[0].aVigiar, [], "quem deve não fica a vigiar");
  const total = emAtrasoDaCarteira(snap).reduce((acc, r) => acc + r.debt, 0);
  assert.equal(linhas.reduce((acc, l) => acc + l.valorEmAtraso, 0), total);
  assert.equal(resumoDoMes(snap).emAtraso, total);
  assert.equal(resumoDoMes(snap).inquilinosEmAtraso, 2);
  assert.equal(linhas[0].valorEmAtraso, 1000);
  assert.equal(linhas[1].valorEmAtraso, 450);
  assert.deepEqual(linhas[0].tira.map((m) => m.chave), lastMonthsKeys(12, MES));
  assert.equal(linhas[0].tira.find((m) => m.chave === "2026-09-01")?.estado, "atraso",
    "o pagamento do outro contrato não esconde o mês em atraso");
}

{
  const c = contrato("fonte-parada");
  const snap = snapshot([c], pagamentos(c).filter((p) => p.ref_month <= "2026-07-01"), {
    landlords: [{ id: "senhorio", name: "Fonte", nif: null, notes: null }],
    receiptsRecentes: [{ contract_id: c.id, ref_month: "2026-07-01", amount: 500,
      landlord_id: "senhorio", issue_date: "2026-07-05" }],
  });
  assert.equal(linha(snap, c).estado, "sem_informacao");
  assert.equal(linha(snap, c).tira.at(-1)?.estado, "sem_info");
  assert.equal(linha(snap, c).valorEmAtraso, 0);
  assert.equal(resumoDoMes(snap).porReceber, 0);
  assert.equal(resumoDoMes(snap).semInformacao, 1, "contagem de rendas sem informação");
  const outro = contrato("outro", { tenant_name: c.tenant_name });
  const combinado = snapshot([c, outro], [...snap.pagamentosRecentes, ...pagamentos(outro)], {
    landlords: snap.fontes.map((f) => f.landlord),
    receiptsRecentes: [{ contract_id: c.id, ref_month: "2026-07-01", amount: 500,
      landlord_id: "senhorio", issue_date: "2026-07-05" }],
  });
  assert.equal(linha(combinado, c).estado, "sem_informacao", "pior que paga ou por receber");
}

{
  const c = contrato("antigo");
  const outro = contrato("atual");
  const velho = pagamentos(c).slice(0, 1).map((p) => ({ ...p, ref_month: "2024-01-01" }));
  const snap = snapshot([c, outro], [...velho, ...pagamentos(outro)]);
  assert.equal(snap.ativos.find((a) => a.activeContract?.id === c.id)?.arrears?.stale, true);
  assert.equal(linha(snap, c).estado, "sem_informacao");
  assert.equal(linha(snap, c).valorEmAtraso, 0);
  assert.equal(resumoDoMes(snap).porReceber, 0);
  assert.equal(resumoDoMes(snap).emAtraso, 0);
  assert.equal(resumoDoMes(snap).total, 1, "stale fica fora das rendas esperadas");
  assert.ok(linha(snap, c).tira.every((m) => m.estado === "sem_info"));
}

{
  const c = contrato("pontual");
  const alteraDatas = (meses: string[], dia: string | null) => pagamentos(c).map((p) =>
    meses.includes(p.ref_month) ? { ...p, received_date: dia ? `${p.ref_month.slice(0, 7)}-${dia}` : null } : p);
  assert.ok(linha(snapshot([c], alteraDatas(FECHADOS.slice(0, 3), "16")), c).aVigiar.includes("paga tarde"));
  assert.ok(!linha(snapshot([c], alteraDatas(FECHADOS.slice(0, 2), "16")), c).aVigiar.includes("paga tarde"));
  assert.ok(!linha(snapshot([c], alteraDatas(FECHADOS, "15")), c).aVigiar.includes("paga tarde"));
  assert.ok(!linha(snapshot([c], alteraDatas(FECHADOS, null)), c).aVigiar.includes("paga tarde"));
  assert.ok(!linha(snapshot([c], alteraDatas([MES, "2026-04-01"], "20")), c).aVigiar.includes("paga tarde"));
  const dividido = pagamentos(c).flatMap((p) => p.ref_month === FECHADOS[0]
    ? [1, 2, 3].map((n) => ({ ...p, id: `${p.id}-${n}`, amount: p.amount / 3, received_date: "2026-05-20" })) : p);
  assert.ok(!linha(snapshot([c], dividido), c).aVigiar.includes("paga tarde"), "conta meses, não movimentos");
  const mesesSeguintes = alteraDatas(FECHADOS.slice(0, 3), "05").map((p) =>
    FECHADOS.slice(0, 3).includes(p.ref_month)
      ? { ...p, received_date: `${addMonthsKey(p.ref_month, 1).slice(0, 7)}-05` } : p);
  assert.ok(linha(snapshot([c], mesesSeguintes), c).aVigiar.includes("paga tarde"));
}

{
  const c = contrato("parcial");
  const pagos = pagamentos(c).map((p) => p.ref_month === FECHADOS[0] ? { ...p, amount: 475 } : p);
  assert.ok(linha(snapshot([c], pagos), c).aVigiar.includes("paga em parte"));
  assert.ok(!linha(snapshot([c]), c).aVigiar.includes("paga em parte"));
  const soCorrente = pagamentos(c).map((p) => p.ref_month === MES ? { ...p, amount: 200 } : p);
  assert.ok(!linha(snapshot([c], soCorrente), c).aVigiar.includes("paga em parte"));
  const retencao = pagamentos(c).map((p) => ({ ...p, amount: 375 }));
  assert.ok(!linha(snapshot([c], retencao), c).aVigiar.includes("paga em parte"), "usa a renda de referência líquida");
  const antiga = pagamentos(c).map((p) => p.ref_month === "2026-04-01" ? { ...p, amount: 300 } : p);
  assert.ok(!linha(snapshot([c], antiga), c).aVigiar.includes("paga em parte"));
}

{
  const contratos = Array.from({ length: 20 }, (_, i) => contrato(`c${i}`));
  const igual = snapshot(contratos);
  assert.ok(!linha(igual, contratos[0]).aVigiar.some((m) => m.startsWith("pesa ")), "5% exatos não dispara");
  const maior = contrato("maior", { rent: 600 });
  assert.ok(linha(snapshot([maior, ...contratos.slice(1)]), maior).aVigiar.includes("pesa 6% da renda"));
  const snap = snapshot([maior]);
  assert.ok(linha(snap, maior, [promessa(maior)]).aVigiar.includes("promessa por cumprir"));
  assert.ok(!linha(snap, maior, [{ ...promessa(maior), prometidoPara: "2026-11-14" }])
    .aVigiar.includes("promessa por cumprir"));
  assert.ok(!linha(snap, maior, [promessa(contrato("outra-pessoa"))]).aVigiar.includes("promessa por cumprir"));
  assert.ok(!linha(snap, maior, [promessa(maior), { ...promessa(maior), tipo: "recibo", dia: "2026-11-11" }])
    .aVigiar.includes("promessa por cumprir"));
}

{
  const c = contrato("faixa");
  const snap = snapshot([c]);
  const mes = snap.ativos[0].faixa.find((m) => m.month === FECHADOS[0])!;
  mes.paid = 0;
  mes.status = "futuro";
  assert.equal(linha(snap, c).tira.find((m) => m.chave === FECHADOS[0])?.estado, "sem_info",
    "reutiliza a faixa, mesmo que pagamentosRecentes tenha outro valor");
  assert.equal(linha(snap, c).tira.at(-1)?.estado, "pago", "o mês corrente vem dos pagamentos recentes");
  const novo = contrato("novo", { start_date: MES });
  assert.equal(linha(snapshot([novo], []), novo).tira[0].estado, "fora");
  assert.equal(linha(snapshot([novo], []), novo).tira.at(-1)?.estado, "por_receber");
}

{
  const nomes = ["Zélia", "Álvaro", "Carla", "Bruno"];
  const contratos = nomes.map((nome) => contrato(nome, { tenant_name: nome }));
  const snap = snapshot(contratos, contratos.flatMap((c, i) => pagamentos(c).filter((p) => i < 2 || p.ref_month !== MES)));
  const linhas = linhasDeRendas(snap, []);
  assert.deepEqual(linhas.map((l) => l.estado), ["por_receber", "por_receber", "paga", "paga"]);
  assert.deepEqual(linhas.map((l) => l.nome), ["Bruno", "Carla", "Álvaro", "Zélia"]);
  const antigo = contrato("cessado", { status: "cessado" });
  assert.deepEqual(linhasDeRendas(snapshot([antigo]), []), [], "não lista antigos inquilinos como rendas atuais");
  const vendido = snapshot([contratos[0]]);
  vendido.correntes = [];
  assert.deepEqual(linhasDeRendas(vendido, []), [], "só imóveis correntes");
}

console.log("rendas.check.ts: OK (resumo, atraso único, agrupamento, fontes, tira e vigilância)");
