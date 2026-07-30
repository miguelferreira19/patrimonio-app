// Saúde dos dados (PLANO.md P1-5) — funções PURAS que procuram anomalias na carteira.
// Nasceu da série de bugs de Atrasos: mais vale a app dizer "este dado está estranho" do que
// deixá-lo sair disfarçado de número certo. Só LEITURA: nada aqui altera dados.
//
// Reutiliza deliberadamente o que já existe: os contratos-zombie e o desalinhamento entre a
// renda contratada e a que os recibos mostram saem das linhas de computeArrears (`stale`,
// `expectedRent`), em vez de reimplementar essa análise.

import type { ArrearsRow } from "./arrears";
import { isCurrentProperty, missingFichaFields } from "./calc";
import { DESALINHAMENTO_MIN, REPETICOES_MIN, desalinhamentoDaRenda, type RendaObservada } from "./rent";
import type { Contract, Property, PropertyOwner } from "./types";

export type HealthSeverity = "erro" | "aviso" | "info";

export interface HealthIssue {
  /** Agrupador — a página faz uma secção por kind. */
  kind: string;
  severity: HealthSeverity;
  title: string;
  detail: string;
  href?: string;
}

/** Nem toda a linha de um `kind` tem a mesma gravidade: as quotas são erro quando passam
 *  dos 100% e "a completar" quando ainda não chegaram lá. A página agrupa por kind e lê a
 *  severidade da PRIMEIRA linha, por isso o grupo tem de sair ordenado por gravidade. */
const PESO: Record<HealthSeverity, number> = { erro: 0, aviso: 1, info: 2 };

export const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  erro: "Erro",
  aviso: "Aviso",
  info: "A completar",
};

export const KIND_LABEL: Record<string, string> = {
  contrato_zombie: "Contratos ativos sem recibos recentes",
  contrato_expirado: "Contratos ativos com data de fim já passada",
  renda_desalinhada: "Recebido abaixo da renda do contrato",
  renda_errada: "Renda registada desalinhada dos recibos",
  contratos_sobrepostos: "Dois contratos ativos na mesma fração",
  renda_invalida: "Rendas a zero ou negativas",
  quotas: "Quotas de propriedade por fechar",
  recibos_orfaos: "Recibos sem contrato associado",
  ficha_incompleta: "Fichas de fração por completar",
};

/** Ordem de apresentação (mais grave primeiro). */
export const KIND_ORDER = Object.keys(KIND_LABEL);

/** Tolerância da soma de quotas, em pontos percentuais. */
export const QUOTA_TOLERANCE = 0.5;
/** Diferença mínima (€) entre renda contratada e renda dos recibos para valer a pena assinalar. */
export const RENT_MISMATCH_EUR = 1;

export interface HealthInput {
  properties: Property[];
  contracts: Contract[];
  owners: PropertyOwner[];
  /** Linhas de computeArrears (contratos ativos). */
  arrears: ArrearsRow[];
  /** Nº de recibos com contract_id nulo (contagem barata, sem ler as linhas todas). */
  orphanReceipts: number;
  /** A renda que os RECIBOS dizem, por contrato (lib/rent.ts). Opcional: sem ela o check
   *  `renda_errada` simplesmente não corre. */
  rendaObservada?: Record<string, RendaObservada>;
  /** YYYY-MM-DD — para o check de contratos com data de fim já passada. */
  today: string;
}

/** true se dois intervalos [aStart, aEnd] e [bStart, bEnd] se cruzam (fim nulo = em aberto). */
export function overlaps(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): boolean {
  if (!aStart || !bStart) return false; // sem data de início não há como afirmar sobreposição
  return aStart <= (bEnd ?? "9999-12-31") && bStart <= (aEnd ?? "9999-12-31");
}

export function computeHealth(input: HealthInput): HealthIssue[] {
  const { orphanReceipts, today } = input;
  // P0-2c: terrenos e imóveis vendidos não entram em NENHUM check — não fazem parte
  // de "métricas correntes" (ver isCurrentProperty em calc.ts). Filtra logo à entrada
  // para não ter de repetir a condição em cada check individual.
  const properties = input.properties.filter(isCurrentProperty);
  const currentIds = new Set(properties.map((p) => p.id));
  const contracts = input.contracts.filter((c) => currentIds.has(c.property_id));
  const owners = input.owners.filter((o) => currentIds.has(o.property_id));
  const arrears = input.arrears.filter((r) => currentIds.has(r.propertyId));
  const propById = new Map(properties.map((p) => [p.id, p]));
  const name = (id: string) => propById.get(id)?.name ?? "Fração desconhecida";
  const issues: HealthIssue[] = [];

  // 1) Contratos ativos sem recibos há mais de STALE_MONTHS — ou o inquilino saiu e o contrato
  //    nunca foi dado como cessado, ou há recibos por importar.
  for (const row of arrears) {
    if (!row.stale) continue;
    issues.push({
      kind: "contrato_zombie",
      severity: "erro",
      title: name(row.propertyId),
      detail: `${row.tenantName} · sem recibos há ${row.streak} meses. Confirmar se o contrato cessou e dar baixa, ou importar os recibos em falta.`,
      href: `/fracoes/${row.propertyId}`,
    });
  }

  // 1b) Contratos ativos cuja data de fim já passou — ou o contrato continua de facto (falta
  //     atualizar end_date/renovação) ou já cessou e falta dar baixa (status='cessado').
  for (const c of contracts) {
    if (c.status !== "ativo" || !c.end_date || c.end_date >= today) continue;
    issues.push({
      kind: "contrato_expirado",
      severity: "aviso",
      title: name(c.property_id),
      detail: `${c.tenant_name} · fim registado em ${c.end_date}, contrato ainda marcado como ativo. Renovar a data de fim ou dar baixa do contrato.`,
      href: `/fracoes/${c.property_id}`,
    });
  }

  // 2) Entra menos dinheiro do que a renda contratada. NÃO é "a renda dos recibos": o número
  //    comparado é o `expectedRent` dos Atrasos, que é `min(renda, MEDIANA DOS PAGAMENTOS)`
  //    de uma janela — cash líquido, não recibos ilíquidos. Duas consequências que estavam a
  //    tornar este aviso falso:
  //
  //    a) A MEDIANA ATRASA-SE POR CONSTRUÇÃO. Numa atualização de renda real, a janela ainda
  //       tem meses ao valor antigo e a mediana fica lá até a maioria virar. Era o caso da
  //       Tevisil: contrato e recibos a 357 EUR desde fevereiro, e este aviso a dizer que
  //       "os recibos mostram 350" — o valor velho, e de uma fonte que não são os recibos.
  //    b) O limiar era 1 EUR ABSOLUTO, por isso qualquer atualização anual pelo coeficiente
  //       (~2%) disparava. É o mesmo erro que o `DESALINHAMENTO_MIN` de lib/rent.ts existe
  //       para evitar, com a mesma justificação escrita lá: 5% deixa passar o coeficiente e
  //       apanha os desvios a sério (a retenção na fonte é 25%).
  //
  //    Por isso: limiar RELATIVO (o mesmo dos 5%), mais o piso de 1 EUR para carteiras de
  //    renda baixa. Quem responde à qualidade do DADO é o `renda_errada` (6b), que lê os
  //    recibos ilíquidos; este aviso responde a outra pergunta — "porque entra menos?".
  //
  //    c) RETENÇÃO NA FONTE (2026-07-30). Sobravam quatro linhas e as quatro eram
  //       inquilinos-empresa a reter 25% na fonte: Lote 2D (600 -> 450), Loja Av.Nova e
  //       Loja de S.Pedro (250 -> 187,50), Garagem (50 -> 37,50). Não há aqui nada para
  //       corrigir: a retenção é imposto entregue ao Estado por conta do senhorio, e
  //       aparece como crédito no IRS. Pior: `payments.amount` É a "Importância recebida"
  //       do recibo, por isso o cash SÓ PODE ficar abaixo do ilíquido por retenção ou por
  //       um mês parcial — este aviso não conseguia apanhar mais nada.
  //       A prova de que é retenção está no dado: os RECIBOS (ilíquidos, `rendaObservada`)
  //       confirmam a renda do contrato. Quando confirmam, o buraco está explicado e não é
  //       anomalia. Quando NÃO confirmam, o aviso mantém-se — aí o dinheiro faturado também
  //       ficou abaixo do contrato, e isso é uma pergunta por responder.
  for (const row of arrears) {
    if (row.semHistorico || row.stale) continue;
    const diff = row.rent - row.expectedRent;
    if (diff <= RENT_MISMATCH_EUR) continue;
    if (row.rent <= 0 || diff / row.rent < DESALINHAMENTO_MIN) continue;
    const obs = input.rendaObservada?.[row.contractId];
    const recibosConfirmam =
      !!obs && obs.vezes >= REPETICOES_MIN && desalinhamentoDaRenda(row.rent, obs) === null;
    if (recibosConfirmam) continue;
    issues.push({
      kind: "renda_desalinhada",
      severity: "aviso",
      title: name(row.propertyId),
      detail: `Contrato diz ${row.rent.toFixed(2)} €, mas o recebido por mês fica em ${row.expectedRent.toFixed(2)} € (mediana dos pagamentos) e os recibos não confirmam a renda do contrato. Verificar se a renda está desatualizada ou se há meses faturados a menos.`,
      href: `/fracoes/${row.propertyId}`,
    });
  }

  // 3) Contratos sobrepostos na mesma fração: a mesma casa não pode estar arrendada duas
  //    vezes AO MESMO TEMPO — e "ao mesmo tempo" quer dizer AGORA, não em 2015.
  //
  //    Antes bastava que os intervalos se cruzassem, e isso dava duas linhas falsas na
  //    carteira real, ambas entre contratos JÁ CESSADOS: uma loja e um andar do mesmo
  //    artigo matricial a conviverem em 2015, e o mesmo inquilino com casa e garagem
  //    registadas na mesma fração. Nenhuma das duas é acionável: o passado não se
  //    "fecha com data de fim", já está fechado, e um andar mais uma garagem no mesmo
  //    artigo é a realidade, não um erro.
  //
  //    O que continua a ser erro é a mesma fração ter DOIS CONTRATOS ATIVOS. Aí o
  //    esperado, os atrasos e a faixa passam a contar duas rendas para uma casa. Nota:
  //    o resto da app já resolve o empate sozinho — o snapshot ordena os contratos por
  //    `start_date` descendente e usa o primeiro ativo, ou seja, O MAIS RECENTE. Este
  //    aviso existe para dizer que a app está a escolher, não para a app parar.
  const byProperty = new Map<string, Contract[]>();
  for (const c of contracts) {
    if (c.status !== "ativo") continue;
    const list = byProperty.get(c.property_id) ?? [];
    list.push(c);
    byProperty.set(c.property_id, list);
  }
  for (const [propertyId, list] of byProperty) {
    // Mais recente primeiro: é o que a app usa, e é o que a mensagem tem de nomear.
    const ordenados = list.slice().sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
    for (let i = 0; i < ordenados.length; i++) {
      for (let j = i + 1; j < ordenados.length; j++) {
        const a = ordenados[i];
        const b = ordenados[j];
        if (!overlaps(a.start_date, a.end_date, b.start_date, b.end_date)) continue;
        issues.push({
          kind: "contratos_sobrepostos",
          severity: "erro",
          title: name(propertyId),
          detail: `Dois contratos ativos: ${a.tenant_name} (desde ${a.start_date ?? "?"}) e ${b.tenant_name} (desde ${b.start_date ?? "?"}). A app usa o mais recente (${a.tenant_name}); dar baixa do outro para as contas deixarem de contar duas rendas.`,
          href: `/fracoes/${propertyId}`,
        });
      }
    }
  }

  // 4) Rendas a zero ou negativas em contratos ativos — envenenam esperado, atrasos e mercado.
  for (const c of contracts) {
    if (c.status !== "ativo" || c.rent > 0) continue;
    issues.push({
      kind: "renda_invalida",
      severity: "erro",
      title: name(c.property_id),
      detail: `${c.tenant_name} · renda registada: ${c.rent} €.`,
      href: `/fracoes/${c.property_id}`,
    });
  }

  // 5) Quotas de propriedade. Só conta as frações que TÊM quotas registadas: as que não têm
  //    ainda não foram preenchidas (isso é a ficha incompleta, não um erro de quotas).
  const quotaByProperty = new Map<string, number>();
  for (const o of owners) {
    quotaByProperty.set(o.property_id, (quotaByProperty.get(o.property_id) ?? 0) + Number(o.quota));
  }
  //
  //    Somar MENOS de 100% não é erro (2026-07-30). O import do Portal só cria uma linha
  //    de `property_owners` por senhorio importado, e a família tem exports de dois (Pai e
  //    Avô): o comproprietário sem export — o tio Ilídio, metade de quase tudo o que é do
  //    Pai — simplesmente não existe na base ainda. Além disso há frações onde a família
  //    é MESMO minoritária e o resto é de terceiros (a garagem 182321-U-1217-A tem 15
  //    titulares; a família detém 6,7%). Nos dois casos a app não tem nada de errado a
  //    apontar: tem conhecimento incompleto, que é o que "a completar" quer dizer.
  //    O upsert dos titulares da caderneta predial está pronto em
  //    `dados/update_cadernetas_pai.sql` e falta colá-lo no SQL Editor.
  //
  //    Passar dos 100% continua a ser ERRO: aí a app está a distribuir património que não
  //    existe, e o Anexo F de alguém fica sobre-declarado.
  for (const [propertyId, total] of quotaByProperty) {
    if (Math.abs(total - 100) <= QUOTA_TOLERANCE) continue;
    const excesso = total > 100;
    issues.push({
      kind: "quotas",
      severity: excesso ? "erro" : "info",
      title: name(propertyId),
      detail: excesso
        ? `As quotas registadas somam ${total.toFixed(1)}%, mais do que a fração inteira. Alguém está a declarar parte a mais no Anexo F.`
        : `Estão registados ${total.toFixed(1)}% de titulares; faltam ${(100 - total).toFixed(1)}%. Ou é compropriedade fora da família (legítimo), ou falta o comproprietário na base. Não afeta a ótica de família, só o IRS de cada um.`,
      href: `/fracoes/${propertyId}`,
    });
  }

  // 6) Recibos órfãos: importados mas sem contrato correspondente — não entram nos pagamentos
  //    nem nos atrasos, ou seja, desaparecem das contas sem dar nas vistas.
  if (orphanReceipts > 0) {
    issues.push({
      kind: "recibos_orfaos",
      severity: "aviso",
      title: `${orphanReceipts} recibos`,
      detail:
        "Foram importados sem contrato associado, por isso não contam para pagamentos nem atrasos. Normalmente falta o contrato no Portal ou o nº de contrato não bate certo.",
    });
  }

  // 6b) Renda registada desalinhada dos recibos, NAS DUAS DIREÇÕES.
  // O `renda_desalinhada` acima só vê rendas ALTAS demais, porque a renda de referência
  // dos Atrasos está limitada a min(rent, mediana). Uma renda BAIXA demais era invisível —
  // e era exatamente o erro real na carteira: dois contratos com a renda a valer uma
  // parcela do último mês (175 em vez de 331, 179 em vez de 290). Ver lib/rent.ts.
  for (const c of contracts) {
    if (c.status !== "ativo") continue;
    const obs = input.rendaObservada?.[c.id];
    const d = desalinhamentoDaRenda(c.rent, obs ?? null);
    if (!d) continue;
    const property = propById.get(c.property_id);
    issues.push({
      kind: "renda_errada",
      severity: "erro",
      title: property?.name ?? c.tenant_name,
      detail:
        d.direcao === "baixa"
          ? `Renda registada ${c.rent} EUR, mas ${obs!.vezes} meses de recibos repetem ${obs!.valor} EUR. ` +
            `Faltam ${d.diferenca} EUR/mes. Causa tipica: a renda foi inferida de um mes com apenas ` +
            `parte dos recibos emitidos. Corrigir na ficha do contrato ou correr "Sincronizar rendas".`
          : `Renda registada ${c.rent} EUR, acima dos ${obs!.valor} EUR que ${obs!.vezes} meses de ` +
            `recibos repetem. Confirmar se a renda subiu ou se esta inflacionada.`,
      href: property ? `/fracoes/${property.id}` : undefined,
    });
  }

  // 7) Fichas de fração incompletas — bloqueiam o €/m² vs INE na página de Mercado (P0-2).
  // A regra vive em calc.ts porque a tira de Cobertura conta o mesmo (PLANO.md §7).
  for (const p of properties) {
    const missing = missingFichaFields(p);
    if (missing.length === 0) continue;
    issues.push({
      kind: "ficha_incompleta",
      severity: "info",
      title: p.name,
      detail: `Em falta: ${missing.join(", ")}. Preencher a partir da caderneta predial.`,
      href: `/fracoes/${p.id}`,
    });
  }

  return issues;
}

export function countBySeverity(issues: HealthIssue[]): Record<HealthSeverity, number> {
  const out: Record<HealthSeverity, number> = { erro: 0, aviso: 0, info: 0 };
  for (const i of issues) out[i.severity] += 1;
  return out;
}

/** Agrupa por kind, pela ordem de KIND_ORDER (mais grave primeiro). Dentro de cada grupo
 *  a linha mais grave vem à frente: a página lê `list[0].severity` para o badge do cartão,
 *  e um grupo misto (quotas) mostrava a etiqueta da primeira linha que calhasse. */
export function groupByKind(issues: HealthIssue[]): Array<[string, HealthIssue[]]> {
  const map = new Map<string, HealthIssue[]>();
  for (const i of issues) map.set(i.kind, [...(map.get(i.kind) ?? []), i]);
  return KIND_ORDER.filter((k) => map.has(k)).map((k) => [
    k,
    map.get(k)!.slice().sort((a, b) => PESO[a.severity] - PESO[b.severity]),
  ]);
}
