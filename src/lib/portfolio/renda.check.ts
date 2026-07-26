// Self-check de renda.ts. Correr com `npm run check:renda`.
import assert from "node:assert/strict";
import {
  acumuladoDoAno,
  concentracao,
  crescimento,
  rendasParadas,
  serieAnual,
} from "./renda";
import type { Contract, RentUpdate, UpdateCoefficient } from "../types";

function contrato(overrides: Partial<Contract> & { id: string }): Contract {
  return {
    property_id: "frac-1",
    tenant_name: "inquilino",
    tenant_nif: null,
    pf_contract_no: null,
    start_date: "2020-01-01",
    end_date: null,
    rent: 500,
    due_day: 8,
    status: "ativo",
    notes: null,
    ...overrides,
  };
}

function pagamento(contractId: string, refMonth: string, amount: number) {
  return { contract_id: contractId, ref_month: refMonth, amount };
}

// A — inquilino com dois contratos em frações diferentes junta-se numa só linha.
{
  const contracts = [
    contrato({ id: "c1", property_id: "frac-1", tenant_name: "Ana Costa", rent: 400 }),
    contrato({ id: "c2", property_id: "frac-2", tenant_name: "Ana Costa", rent: 300 }),
  ];
  const payments = [
    pagamento("c1", "2026-06-01", 400),
    pagamento("c2", "2026-06-01", 300),
  ];
  const hoje = new Date(2026, 6, 15); // 15 jul 2026
  const conc = concentracao(contracts, payments, hoje);
  assert.equal(conc.porInquilino.length, 1, "as duas frações juntam-se num só inquilino");
  assert.equal(conc.porInquilino[0].recebido12m, 700, "soma as duas frações");
  assert.equal(conc.porFracao.length, 2, "por fração continuam separadas");
}

// B — inquilino com NIF vence o agrupamento por nome: dois nomes escritos de forma
// diferente com o mesmo NIF são UM só (e a armadilha não deixa fuzzy match salvar quem
// não tem NIF).
{
  const contracts = [
    contrato({ id: "c1", tenant_name: "Joao Silva", tenant_nif: "123456789", rent: 400 }),
    contrato({ id: "c2", tenant_name: "JOÃO  SILVA LDA", tenant_nif: "123456789", rent: 100 }),
    // Dois nomes parecidos SEM NIF: não se juntam (nunca fuzzy match).
    contrato({ id: "c3", tenant_name: "Maria Santos", tenant_nif: null, rent: 200 }),
    contrato({ id: "c4", tenant_name: "Maria Santos ", tenant_nif: null, rent: 200 }),
  ];
  const payments = [
    pagamento("c1", "2026-05-01", 400),
    pagamento("c2", "2026-05-01", 100),
    pagamento("c3", "2026-05-01", 200),
    pagamento("c4", "2026-05-01", 200),
  ];
  const hoje = new Date(2026, 6, 15);
  const conc = concentracao(contracts, payments, hoje);
  const doNif = conc.porInquilino.find((l) => l.chave === "nif:123456789");
  assert.ok(doNif, "o grupo por NIF existe");
  assert.equal(doNif!.recebido12m, 500, "as duas grafias do mesmo NIF somam-se");

  // "Maria Santos" e "Maria Santos " (só um espaço a mais) normalizam para o MESMO
  // nome, por isso juntam-se: a normalização colapsa espaços, não é fuzzy match.
  const porNome = conc.porInquilino.filter((l) => l.chave.startsWith("nome:"));
  assert.equal(porNome.length, 1, "espaço a mais normaliza para o mesmo grupo");
  assert.equal(conc.agrupadosPorNome, 1, "só um grupo foi formado por nome");
}

// C — ano corrente parcial NÃO entra no CAGR.
{
  const serie = [
    { ano: 2023, recebido: 10000, meses: 12, rendaMediaMensal: 833.33, parcial: false },
    { ano: 2024, recebido: 11000, meses: 12, rendaMediaMensal: 916.67, parcial: false },
    { ano: 2025, recebido: 12000, meses: 12, rendaMediaMensal: 1000, parcial: false },
    // 2026 só tem 6 meses de dados: entra na série mas não pode inflacionar o CAGR.
    { ano: 2026, recebido: 200000, meses: 6, rendaMediaMensal: 33333, parcial: true },
  ];
  const c = crescimento(serie);
  const esperado = Math.pow(12000 / 10000, 1 / 2) - 1;
  assert.ok(c.cagr !== null && Math.abs(c.cagr - esperado) < 1e-9, "CAGR só 2023 a 2025");
  assert.equal(c.porAno.length, 4, "porAno cobre a serie toda, so o CAGR filtra");
}

// D — carteira vazia devolve zeros/null em todas as funções, sem rebentar.
{
  const hoje = new Date(2026, 6, 15);
  const acumulado = acumuladoDoAno([], hoje);
  assert.equal(acumulado.length, 12, "12 pontos mesmo sem pagamentos");
  assert.ok(acumulado.every((p) => p.anoAnterior === 0), "ano anterior a zero");
  assert.ok(
    acumulado.filter((p) => p.esteAno !== null).every((p) => p.esteAno === 0),
    "meses decorridos a zero",
  );

  assert.deepEqual(serieAnual([], []), [], "sem pagamentos nao ha serie anual");
  const cr = crescimento([]);
  assert.equal(cr.cagr, null, "sem serie nao ha CAGR");
  assert.deepEqual(cr.porAno, []);

  assert.deepEqual(rendasParadas([], [], [], hoje), [], "sem contratos nao ha rendas paradas");

  const conc = concentracao([], [], hoje);
  assert.deepEqual(conc.porInquilino, []);
  assert.deepEqual(conc.porFracao, []);
  assert.equal(conc.hhi, 0);
  assert.equal(conc.agrupadosPorNome, 0);
}

// E — acumuladoDoAno acumula mesmo (dezembro é a soma do ano inteiro) e mete null nos
// meses futuros do ano corrente.
{
  const payments = [
    pagamento("c1", "2026-01-01", 100),
    pagamento("c1", "2026-02-01", 100),
    pagamento("c1", "2026-03-01", 100),
    // 2025 (ano anterior) completo, para provar que essa série nunca fica a null.
    pagamento("c1", "2025-11-01", 50),
    pagamento("c1", "2025-12-01", 50),
  ];
  const hoje = new Date(2026, 2, 20); // 20 mar 2026: so jan/fev/mar ja decorreram
  const pontos = acumuladoDoAno(payments, hoje);
  assert.equal(pontos.length, 12);
  assert.equal(pontos[0].esteAno, 100, "janeiro acumula so janeiro");
  assert.equal(pontos[1].esteAno, 200, "fevereiro acumula jan+fev");
  assert.equal(pontos[2].esteAno, 300, "marco acumula jan+fev+mar");
  assert.equal(pontos[3].esteAno, null, "abril ainda nao decorreu no ano corrente");
  assert.equal(pontos[11].esteAno, null, "dezembro tambem fica a null, ainda nao chegou");
  // Ano anterior sempre completo: dezembro de 2025 e a soma do ano (so tem nov+dez=100).
  assert.equal(pontos[11].anoAnterior, 100, "ano anterior acumula ate dezembro, sempre");
  assert.equal(pontos[10].anoAnterior, 50, "novembro do ano anterior so tem o proprio mes");
}

// F — rendasParadas não devolve contratos atualizados há menos de 24 meses (o mesesMin
// por defeito), só os parados de facto.
{
  const hoje = new Date(2026, 6, 26); // 26 jul 2026
  const contracts = [
    // Atualizado ha 6 meses: nao e "parado".
    contrato({ id: "recente", rent: 500 }),
    // Sem nenhuma atualização, a contar desde o inicio do contrato ha 4 anos: parado.
    contrato({ id: "parado", rent: 400, start_date: "2022-01-01" }),
  ];
  const rentUpdates: RentUpdate[] = [
    {
      id: "u1",
      contract_id: "recente",
      effective_date: "2026-01-15",
      old_rent: 480,
      new_rent: 500,
      reason: "coeficiente",
    },
  ];
  const coefficients: UpdateCoefficient[] = [{ year: 2026, coefficient: 1.02 }];

  const paradas = rendasParadas(contracts, rentUpdates, coefficients, hoje);
  const ids = paradas.map((p) => p.contractId);
  assert.ok(!ids.includes("recente"), "atualizado ha 6 meses nao entra");
  assert.ok(ids.includes("parado"), "sem atualizacao ha 4 anos entra");
  const linha = paradas.find((p) => p.contractId === "parado")!;
  assert.ok(linha.mesesSemAtualizar >= 24, "pelo menos 24 meses parado");
  assert.equal(
    Math.round(linha.rendaSugerida! * 100) / 100,
    Math.round(400 * 1.02 * 100) / 100,
    "renda sugerida vem do coeficiente mais recente",
  );
  assert.equal(
    Math.round(linha.ganhoAnual * 100) / 100,
    Math.round((400 * 1.02 - 400) * 12 * 100) / 100,
    "ganho anual = (sugerida - atual) x 12",
  );

  // mesesMin custom: o "parado" tem ~54 meses sem atualizar (inicio em 2022-01-01);
  // com um limiar de 60 deixa de ser exigente o suficiente e sai da lista.
  const maisExigente = rendasParadas(contracts, rentUpdates, coefficients, hoje, 60);
  assert.ok(!maisExigente.some((p) => p.contractId === "parado"), "60 meses e mais exigente que os ~54 do contrato");
}

console.log("renda.check.ts: OK (A, B, C, D, E, F)");
