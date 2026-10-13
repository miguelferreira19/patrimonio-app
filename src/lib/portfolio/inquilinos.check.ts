// Self-check de inquilinos.ts. Corre com `npm run check`.
import assert from "node:assert/strict";
import { chaveDoInquilino, devedores, fichaDoInquilino, fichasDeInquilinos } from "./inquilinos";
import { addMonthsKey } from "../format";
import type { Ativo, Snapshot } from "./snapshot";
import type { ArrearsRow } from "../arrears";
import type { Contract, Payment, Property } from "../types";

function property(id: string): Property {
  return {
    id, name: `Fração ${id}`, address: null, postal_code: null, municipality: null,
    parish: null, dicofre: null, typology: "T2", area_m2: null, vpt: null, vpt_year: null,
    matriz_article: null, status: "arrendado", notes: null,
  };
}

function contract(over: Partial<Contract> & { id: string; property_id: string }): Contract {
  return {
    tenant_name: "Inquilino", tenant_nif: null, pf_contract_no: null,
    start_date: "2020-01-01", end_date: null, rent: 500, due_day: 1,
    status: "ativo", notes: null, ...over,
  };
}

function arrears(over: Partial<ArrearsRow> & { contractId: string }): ArrearsRow {
  return {
    propertyId: "p", tenantName: "x", pfContractNo: null, rent: 500, startDate: null,
    lastPaidMonth: null, expectedRent: 500, stale: false, streak: 0, semHistorico: false,
    cadence: null, severity: "ok", debt: 0, months: [], ...over,
  } as ArrearsRow;
}

function ativo(over: Partial<Ativo> & { property: Property; contracts: Contract[] }): Ativo {
  return {
    activeContract: over.contracts.find((c) => c.status === "ativo") ?? null,
    titulares: [], corrente: true, fichaEmFalta: [],
    mercado: { rentPerM2: null, benchmarkRentM2: null, deviation: null, gapEurMonth: null,
      estimatedValue: null, grossYield: null, benchmark: undefined },
    arrears: null, faixa: [], vazios: [], rendaAtualizavel: null, risco: null, ...over,
  };
}

function pagamento(contract_id: string, amount: number): Payment {
  return { id: `pg-${contract_id}-${amount}`, contract_id, ref_month: "2026-01-01", amount,
    received_date: null, method: "transferencia", source: "manual", notes: null };
}

function snapshot(ativos: Ativo[], pagamentosRecentes: Payment[] = []): Snapshot {
  return { ativos, correntes: ativos, pagamentosRecentes } as unknown as Snapshot;
}

// A — a chave é o NIF quando existe, e o nome normalizado quando não existe. Duas grafias
// do mesmo nome (acentos, maiúsculas, espaços a mais) caem na mesma ficha; é o máximo que
// se faz sem NIF, e nunca fuzzy match.
{
  assert.equal(chaveDoInquilino({ tenant_nif: "123456789", tenant_name: "Ana" }), "nif:123456789");
  assert.equal(
    chaveDoInquilino({ tenant_nif: null, tenant_name: "  JOÃO   Silva " }),
    chaveDoInquilino({ tenant_nif: null, tenant_name: "joao silva" }),
  );
  // NIF diferente = pessoa diferente, mesmo com o nome igual.
  assert.notEqual(
    chaveDoInquilino({ tenant_nif: "1", tenant_name: "Ana" }),
    chaveDoInquilino({ tenant_nif: "2", tenant_name: "Ana" }),
  );
  // O NIF manda sobre o nome: a mesma pessoa com o nome escrito de outra maneira junta-se.
  assert.equal(
    chaveDoInquilino({ tenant_nif: "9", tenant_name: "Ana Maria" }),
    chaveDoInquilino({ tenant_nif: "9", tenant_name: "ana m." }),
  );
}

// B — um inquilino com contratos em DUAS frações: soma renda e recebido, e agrega os dois.
{
  const c1 = contract({ id: "c1", property_id: "p1", tenant_nif: "500", tenant_name: "Ana", rent: 400 });
  const c2 = contract({ id: "c2", property_id: "p2", tenant_nif: "500", tenant_name: "Ana", rent: 350 });
  const snap = snapshot(
    [
      ativo({ property: property("p1"), contracts: [c1], arrears: arrears({ contractId: "c1", debt: 800, severity: "atraso" }) }),
      ativo({ property: property("p2"), contracts: [c2], arrears: arrears({ contractId: "c2", debt: 0, severity: "ok" }) }),
    ],
    [pagamento("c1", 400), pagamento("c2", 350), pagamento("c1", 400)],
  );

  const fichas = fichasDeInquilinos(snap);
  assert.equal(fichas.length, 1, "um NIF, uma ficha, mesmo com duas frações");
  const f = fichas[0];
  assert.equal(f.rendaMensal, 750);
  assert.equal(f.recebido12m, 1150);
  assert.equal(f.contratos.length, 2);
  assert.equal(f.ativos, 2);
  assert.equal(f.divida, 800);
  assert.equal(f.severidade, "atraso", "a PIOR severidade dos contratos ativos");
  assert.equal(f.porNome, false);
  assert.equal(fichaDoInquilino(snap, f.chave)?.chave, f.chave);
  assert.equal(fichaDoInquilino(snap, "nif:000"), undefined);
}

// C — contrato CESSADO: continua na ficha (é a história do inquilino) mas não conta para a
// renda mensal nem herda o atraso do contrato ativo da fração, que é de OUTRA pessoa. Era
// o erro fácil aqui: o snapshot só tem `arrears` do contrato ativo, e atribuí-lo a todos
// os contratos da fração punha a dívida do inquilino atual na ficha do anterior.
{
  const antigo = contract({ id: "velho", property_id: "p1", tenant_name: "Bruno",
    status: "cessado", start_date: "2015-01-01", end_date: "2019-12-31", rent: 300 });
  const atual = contract({ id: "novo", property_id: "p1", tenant_name: "Carla",
    start_date: "2020-01-01", rent: 500 });
  const snap = snapshot([
    ativo({
      property: property("p1"), contracts: [atual, antigo],
      arrears: arrears({ contractId: "novo", debt: 1500, severity: "critico" }),
    }),
  ]);

  const fichas = fichasDeInquilinos(snap);
  assert.equal(fichas.length, 2);
  const bruno = fichas.find((f) => f.nome === "Bruno")!;
  assert.equal(bruno.ativos, 0);
  assert.equal(bruno.cessados, 1);
  assert.equal(bruno.rendaMensal, 0);
  assert.equal(bruno.divida, 0, "a dívida do contrato ativo NÃO é do inquilino que saiu");
  assert.equal(bruno.severidade, null);
  assert.equal(bruno.desde, "2015-01-01");

  const carla = fichas.find((f) => f.nome === "Carla")!;
  assert.equal(carla.divida, 1500);
  assert.equal(carla.porNome, true, "sem NIF, o agrupamento é por nome e a ficha di-lo");
  assert.equal(fichas[0].nome, "Carla", "ordenado pela renda ativa");
}

// D — devedores: agrupa por inquilino a MESMA lista do Hoje (emAtrasoDaCarteira). Fica de
// fora quem tem ritmo próprio (paga ao trimestre) e quem está em dia.
{
  const meses24 = (fim: string) =>
    Array.from({ length: 24 }, (_, i) => ({ month: addMonthsKey(fim, i - 23), status: "pago", paid: 0, deficit: 0 }));
  const row = (over: Partial<ArrearsRow> & { contractId: string }) =>
    arrears({ months24: meses24("2026-09-01"), severity: "critico", ...over } as Partial<ArrearsRow> & { contractId: string });
  const a1 = contract({ id: "a1", property_id: "p1", tenant_nif: "700", tenant_name: "Amin", rent: 438 });
  const a2 = contract({ id: "a2", property_id: "p2", tenant_nif: "700", tenant_name: "Amin", rent: 331 });
  const b = contract({ id: "b", property_id: "p3", tenant_name: "Casa", rent: 295 });
  const t = contract({ id: "t", property_id: "p4", tenant_name: "Trimestral", rent: 900 });
  const linhas = [
    row({ contractId: "a1", propertyId: "p1", streak: 5, debt: 5 * 438, lastPaidMonth: "2026-04-01" }),
    row({ contractId: "a2", propertyId: "p2", streak: 1, debt: 331, lastPaidMonth: "2026-08-01" }),
    row({ contractId: "b", propertyId: "p3", streak: 4, debt: 4 * 295, lastPaidMonth: "2026-05-01" }),
    row({ contractId: "t", propertyId: "p4", streak: 2, debt: 1800, severity: "ritmo_proprio" }),
  ];
  const lista = devedores({
    arrears: { rows: linhas, summary: {} as Snapshot["arrears"]["summary"] },
    ativos: [
      ativo({ property: property("p1"), contracts: [a1] }),
      ativo({ property: property("p2"), contracts: [a2] }),
      ativo({ property: property("p3"), contracts: [b] }),
      ativo({ property: property("p4"), contracts: [t] }),
    ],
  });
  assert.equal(lista.length, 2, "o trimestral não é devedor");
  assert.equal(lista[0].nome, "Amin", "o maior valor primeiro");
  assert.equal(lista[0].divida, 5 * 438 + 331, "um inquilino, dois contratos");
  assert.equal(lista[0].desde, "2026-05-01", "o mês por pagar mais antigo");
  assert.equal(lista[0].contratos[0].contract.id, "a1");
  assert.equal(lista[1].contratos[0].desde, "2026-06-01");
}

console.log("inquilinos.check.ts: OK (A, B, C, D)");
