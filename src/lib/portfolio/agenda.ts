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
import { aimiExposure } from "../irs";
import type { Landlord, Property, PropertyOwner } from "../types";

export interface Prazo {
  /** O dia do prazo (o último dia, quando é uma janela). `YYYY-MM-DD`. */
  data: string;
  /** Identificador estável: é o UID do evento no .ics, e não pode mudar entre exports,
   *  senão o calendário duplica o evento em vez de o atualizar. */
  id: string;
  tipo: "fiscal" | "renda";
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

export const ANTECEDENCIA_CARTA_DIAS = 30;

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Os prazos fiscais de um ano civil. Não dependem da carteira, só do calendário. */
export function prazosFiscais(ano: number, aimi: AimiDoSenhorio[] = []): Prazo[] {
  const regraImi =
    "Até 100 € paga-se tudo em maio; até 500 €, em maio e novembro; acima, em maio, agosto " +
    "e novembro (art. 120.º do CIMI). Confirmar na nota de cobrança de cada senhorio.";
  const prazos: Prazo[] = [
    {
      data: `${ano}-05-31`,
      id: `imi-1-${ano}`,
      tipo: "fiscal",
      titulo: "IMI: 1.ª prestação (ou pagamento único)",
      detalhe: regraImi,
      euros: null,
      confianca: "assumido",
    },
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
      href: `/ano/${ano - 1}`,
    },
    {
      data: `${ano}-08-31`,
      id: `imi-2-${ano}`,
      tipo: "fiscal",
      titulo: "IMI: 2.ª prestação (notas acima de 500 €)",
      detalhe: regraImi,
      euros: null,
      confianca: "assumido",
    },
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
      href: `/ano/${ano}`,
    });
  }
  prazos.push({
    data: `${ano}-11-30`,
    id: `imi-3-${ano}`,
    tipo: "fiscal",
    titulo: "IMI: última prestação (notas acima de 100 €)",
    detalhe: regraImi,
    euros: null,
    confianca: "assumido",
  });
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
