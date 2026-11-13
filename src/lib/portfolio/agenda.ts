// A AGENDA: os prazos que a carteira impõe, por data (2026-10-03). Módulo PURO.
//
// A fila do Agora responde "o que decidir hoje"; isto responde "o que vem aí e até
// quando". São coisas diferentes, e misturá-las enchia a fila de lembretes com meses de
// antecedência. Também é o que se exporta para o calendário do telemóvel (`lib/ics.ts`):
// a família não abre esta app todos os dias, mas olha para o calendário.
//
// Prazos LEGAIS usados, todos de calendário fixo:
//   - IRS (Modelo 3, com o Anexo F): entrega de 1 de abril a 30 de junho (art. 60.º CIRS).
//   - IMI: maio se a nota for até 100 €; maio e novembro até 500 €; maio, agosto e novembro
//     acima disso (art. 120.º CIMI). A app não tem a nota de cobrança, por isso lista as
//     três datas e diz a regra, em vez de fingir que sabe quantas prestações há.
//   - AIMI: pago durante setembro. O valor é o que a app já calcula para o /ano.
//   - Atualização de renda: a carta tem de chegar com 30 dias de antecedência (art. 1077.º
//     n.º 2 CC). O último dia para a enviar é a data de elegibilidade menos 30 dias.

import { fmtEur } from "../format";
import { aimiExposure, expenseShare, quotaPctByProperty } from "../irs";
import type { Expense, Landlord, Property, PropertyOwner } from "../types";

export interface Prazo {
  /** O dia do prazo (o último dia, quando é uma janela). `YYYY-MM-DD`. */
  data: string;
  /** Identificador estável: é o UID do evento no .ics, e não pode mudar entre exports,
   *  senão o calendário duplica o evento em vez de o atualizar. */
  id: string;
  tipo: "fiscal" | "renda" | "contrato";
  titulo: string;
  detalhe: string;
  euros: number | null;
  /** `assumido` quando a app não tem o número exato (a nota do IMI, o AIMI estimado). */
  confianca: "medido" | "assumido";
  href?: string;
}

export interface RendaAtualizavel {
  contractId: string;
  fracao: string;
  inquilino: string;
  renda: number;
  /** Data a partir da qual a renda pode subir. */
  elegivelDesde: string;
  rendaSugerida: number | null;
}

export interface AimiDoSenhorio {
  senhorio: string;
  valor: number;
}

export type TipoDePrazo = "imi" | "aimi" | "irs" | "contrato" | "renda" | "heranca";

// Prazo continua a ser o contrato do feed .ics e dos consumidores atuais.
export type PrazoDoAno = {
  id: string;
  dia: string;
  titulo: string;
  valor: number | null;
  estimado: boolean;
  senhorio: string | null;
  tipo: TipoDePrazo;
  feito: boolean;
  nota?: string;
};

export type EntradaDosPrazos = {
  ano: number;
  hoje: string;
  despesas: Expense[];
  senhorios: Landlord[];
  aimi: AimiDoSenhorio[];
  rendas: RendaAtualizavel[];
  feitos: Set<string>;
  /** Necessários para repartir despesas com landlord_id nulo, sem presumir quotas. */
  titulares?: PropertyOwner[];
};

// Fonte: dados/sucessao, obrigação no ano seguinte ao óbito de 2026.
const IRS_HERANCA = { ano: 2027, titulo: "IRS do ano do óbito: declaração do falecido" };

function prazosImi(e: EntradaDosPrazos): PrazoDoAno[] {
  return e.senhorios.flatMap((s) => {
    const quotas = quotaPctByProperty(e.titulares ?? [], s.id);
    const despesas = e.despesas.filter((d) => d.category === "imi" &&
      d.expense_date.startsWith(`${e.ano - 1}-`) && d.origem === "registada" &&
      (d.landlord_id === s.id || (d.landlord_id === null && quotas.has(d.property_id ?? ""))));
    const centimos = despesas.length === 0 ? null : Math.round(despesas.reduce((total, d) =>
      total + expenseShare(d, s.id, quotas.get(d.property_id ?? ""), { apenasRegistadas: true }), 0) * 100);
    const datas = centimos === null || centimos <= 10000 ? ["05-31"] :
      centimos <= 50000 ? ["05-31", "11-30"] : ["05-31", "08-31", "11-30"];
    const parcela = centimos === null ? null : Math.floor(centimos / datas.length);
    return datas.map((data, i) => ({
      id: `imi:${e.ano}:${s.id}:${i + 1}`, dia: `${e.ano}-${data}`,
      titulo: `IMI: ${datas.length === 1 ? "pagamento único" : `${i + 1}.ª prestação`} (${s.name})`,
      valor: centimos === null || parcela === null ? null :
        (i === datas.length - 1 ? centimos - parcela * i : parcela) / 100,
      estimado: true, senhorio: s.name, tipo: "imi" as const, feito: false,
      nota: "Estimativa pelo IMI do ano anterior.",
    }));
  });
}

const porDiaETitulo = (a: PrazoDoAno, b: PrazoDoAno) =>
  a.dia.localeCompare(b.dia) || a.titulo.localeCompare(b.titulo) || a.id.localeCompare(b.id);

export function prazosDoAno(e: EntradaDosPrazos): PrazoDoAno[] {
  const prazos: PrazoDoAno[] = [
    ...prazosImi(e),
    { id: `irs:${e.ano}:entrega`, dia: `${e.ano}-06-30`,
      titulo: "IRS: entregar a declaração (Anexo F)", valor: null,
      estimado: false, senhorio: null, tipo: "irs", feito: false,
      nota: "Entrega de 1 de abril a 30 de junho." },
    { id: `irs:${e.ano}:pagamento`, dia: `${e.ano}-08-31`, titulo: "IRS: pagamento",
      valor: null, estimado: false, senhorio: null, tipo: "irs", feito: false },
    ...e.aimi.filter((a) => a.valor > 0).map((a): PrazoDoAno => ({
      id: `aimi:${e.ano}:${e.senhorios.find((s) => s.name === a.senhorio)?.id ?? a.senhorio}`,
      dia: `${e.ano}-09-30`, titulo: `AIMI: pagamento (${a.senhorio})`, valor: a.valor,
      estimado: true, senhorio: a.senhorio, tipo: "aimi", feito: false,
    })),
    ...prazosDeRenda(e.rendas, e.hoje, `${e.ano}-12-31`)
      .filter((p) => p.data.startsWith(`${e.ano}-`)).map((p): PrazoDoAno => ({
        id: p.id, dia: p.data, titulo: p.titulo, valor: p.euros,
        estimado: p.confianca === "assumido", senhorio: null, tipo: "renda", feito: false,
        nota: p.detalhe,
      })),
  ];
  if (e.ano === IRS_HERANCA.ano) {
    prazos.push(...e.senhorios.filter((s) => s.name.startsWith("Herança"))
      .map((s): PrazoDoAno => ({
        id: `heranca:${e.ano}:${s.id}:irs`, dia: `${e.ano}-06-30`, titulo: IRS_HERANCA.titulo,
        valor: null, estimado: false, senhorio: s.name, tipo: "heranca", feito: false,
      })));
  }
  return prazos.map((p) => ({ ...p, feito: e.feitos.has(p.id) })).sort(porDiaETitulo);
}

export function proximosPrazos(prazos: PrazoDoAno[], hoje: string, n: number): PrazoDoAno[] {
  return prazos.filter((p) => p.dia >= hoje && !p.feito).sort(porDiaETitulo).slice(0, Math.max(0, n));
}

export const ANTECEDENCIA_CARTA_DIAS = 30;

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function imiFiscalLegado(ano: number): Prazo[] {
  const regraImi =
    "Até 100 € paga-se tudo em maio; até 500 €, em maio e novembro; acima, em maio, agosto " +
    "e novembro (art. 120.º do CIMI). Confirmar na nota de cobrança de cada senhorio.";
  return [
    ["05-31", "IMI: 1.ª prestação (ou pagamento único)"],
    ["08-31", "IMI: 2.ª prestação (notas acima de 500 €)"],
    ["11-30", "IMI: última prestação (notas acima de 100 €)"],
  ].map(([data, titulo], i) => ({
    data: `${ano}-${data}`, id: `imi-${i + 1}-${ano}`, tipo: "fiscal", titulo,
    detalhe: regraImi, euros: null, confianca: "assumido",
  }));
}

/** Calendário fiscal legado, preservado para o feed .ics e a página Hoje. */
export function prazosFiscais(ano: number, aimi: AimiDoSenhorio[] = []): Prazo[] {
  const imi = imiFiscalLegado(ano);
  const prazos: Prazo[] = [
    imi[0],
    {
      data: `${ano}-06-30`,
      id: `irs-${ano}`,
      tipo: "fiscal",
      titulo: `IRS ${ano - 1}: último dia de entrega (com o Anexo F)`,
      detalhe:
        "A entrega abre a 1 de abril. O Anexo F de cada senhorio está na página do Ano, " +
        "pronto a copiar para o Portal.",
      euros: null,
      confianca: "medido",
      href: `/impostos?ano=${ano - 1}`,
    },
    imi[1],
  ];
  const aimiPositivo = aimi.filter((a) => a.valor > 0);
  if (aimiPositivo.length > 0) {
    const total = aimiPositivo.reduce((s, a) => s + a.valor, 0);
    prazos.push({
      data: `${ano}-09-30`,
      id: `aimi-${ano}`,
      tipo: "fiscal",
      titulo: "AIMI: pagamento durante setembro",
      detalhe:
        aimiPositivo.map((a) => `${a.senhorio}: ${fmtEur(a.valor)}`).join(" · ") +
        ". Estimado pela app com tributação individual; o valor certo é o da nota de cobrança.",
      euros: total,
      confianca: "assumido",
      href: `/impostos?ano=${ano}`,
    });
  }
  prazos.push(imi[2]);
  return prazos;
}

/** Cartas de atualização de renda que têm de sair dentro da janela.
 *
 *  Só as que ainda NÃO são elegíveis hoje: as que já são estão na fila do Agora como
 *  decisão ("Atualizar N rendas"), e repeti-las aqui era dizer a mesma coisa duas vezes.
 *  Quando faltam menos de 30 dias, o prazo é hoje: a carta já não chega a tempo da data
 *  de elegibilidade, e quanto mais tarde sair, mais tarde a renda sobe. */
export function prazosDeRenda(rendas: RendaAtualizavel[], hoje: string, ate: string): Prazo[] {
  const out: Prazo[] = [];
  for (const r of rendas) {
    if (r.elegivelDesde <= hoje) continue;
    if (r.rendaSugerida !== null && r.rendaSugerida <= r.renda) continue;
    const limite = somarDias(r.elegivelDesde, -ANTECEDENCIA_CARTA_DIAS);
    const data = limite < hoje ? hoje : limite;
    if (data > ate) continue;
    const ganhoAno = r.rendaSugerida !== null ? (r.rendaSugerida - r.renda) * 12 : null;
    out.push({
      data,
      id: `renda-${r.contractId}-${r.elegivelDesde}`,
      tipo: "renda",
      titulo: `Enviar a carta de atualização: ${r.fracao}`,
      detalhe:
        `A renda de ${r.inquilino} pode subir a partir de ${r.elegivelDesde.split("-").reverse().join("/")}, ` +
        `e a carta tem de chegar com ${ANTECEDENCIA_CARTA_DIAS} dias de antecedência (art. 1077.º do CC).` +
        (r.rendaSugerida !== null
          ? ` De ${fmtEur(r.renda, 2)} para ${fmtEur(r.rendaSugerida, 2)}.`
          : " Ainda falta o coeficiente do ano para calcular a nova renda."),
      euros: ganhoAno,
      confianca: r.rendaSugerida !== null ? "medido" : "assumido",
      href: `/carta/${r.contractId}`,
    });
  }
  return out;
}

/** Tudo o que cai entre hoje e `hoje + dias`, por data. Os prazos fiscais vêm do ano
 *  corrente e do seguinte, para a janela poder atravessar o 31 de dezembro. */
export function construirAgenda(input: {
  hoje: string;
  dias: number;
  rendas: RendaAtualizavel[];
  aimi: AimiDoSenhorio[];
}): Prazo[] {
  const ate = somarDias(input.hoje, input.dias);
  const ano = parseInt(input.hoje.slice(0, 4), 10);
  const fiscais = [...prazosFiscais(ano, input.aimi), ...prazosFiscais(ano + 1, input.aimi)];
  return [...fiscais, ...prazosDeRenda(input.rendas, input.hoje, ate)]
    .filter((p) => p.data >= input.hoje && p.data <= ate)
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
}

// ---------- Adaptadores: do snapshot para as entradas da agenda ----------

/** As rendas que o snapshot já sabe atualizar (`rentUpdateEligibility` por ativo). */
export function rendasDosAtivos(
  ativos: Array<{
    property: { name: string };
    activeContract: { id: string; tenant_name: string; rent: number } | null;
    rendaAtualizavel: { eligibleSince: string | null; suggestedRent: number | null } | null;
  }>,
): RendaAtualizavel[] {
  return ativos.flatMap((a) =>
    a.activeContract && a.rendaAtualizavel?.eligibleSince
      ? [
          {
            contractId: a.activeContract.id,
            fracao: a.property.name,
            inquilino: a.activeContract.tenant_name,
            renda: a.activeContract.rent,
            elegivelDesde: a.rendaAtualizavel.eligibleSince,
            rendaSugerida: a.rendaAtualizavel.suggestedRent,
          },
        ]
      : [],
  );
}

/** O AIMI de cada senhorio, pela MESMA função que o /ano e o export do IRS usam. */
export function aimiPorSenhorio(
  landlords: Landlord[],
  owners: PropertyOwner[],
  properties: Property[],
): AimiDoSenhorio[] {
  const porId = new Map(properties.map((p) => [p.id, p]));
  return landlords.map((l) => ({
    senhorio: l.name,
    valor: aimiExposure(l.id, owners, porId).tax,
  }));
}
