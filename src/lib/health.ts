// Saúde dos dados (PLANO.md P1-5) — funções PURAS que procuram anomalias na carteira.
// Nasceu da série de bugs de Atrasos: mais vale a app dizer "este dado está estranho" do que
// deixá-lo sair disfarçado de número certo. Só LEITURA: nada aqui altera dados.
//
// Reutiliza deliberadamente o que já existe: os contratos-zombie e o desalinhamento entre a
// renda contratada e a que os recibos mostram saem das linhas de computeArrears (`stale`,
// `expectedRent`), em vez de reimplementar essa análise.

import type { ArrearsRow } from "./arrears";
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

export const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  erro: "Erro",
  aviso: "Aviso",
  info: "A completar",
};

export const KIND_LABEL: Record<string, string> = {
  contrato_zombie: "Contratos ativos sem recibos recentes",
  contrato_expirado: "Contratos ativos com data de fim já passada",
  renda_desalinhada: "Renda do contrato diferente da dos recibos",
  contratos_sobrepostos: "Contratos sobrepostos na mesma fração",
  renda_invalida: "Rendas a zero ou negativas",
  quotas: "Quotas de propriedade que não somam 100%",
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
  const { properties, contracts, owners, arrears, orphanReceipts, today } = input;
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

  // 2) A renda do contrato não bate certo com a que os recibos mostram. Causas legítimas
  //    (retenção na fonte de 25% em inquilinos-empresa) e ilegítimas (renda atualizada na app
  //    sem os recibos correspondentes) — a app não consegue distinguir, por isso só assinala.
  for (const row of arrears) {
    if (row.semHistorico || row.stale) continue;
    const diff = row.rent - row.expectedRent;
    if (diff <= RENT_MISMATCH_EUR) continue;
    issues.push({
      kind: "renda_desalinhada",
      severity: "aviso",
      title: name(row.propertyId),
      detail: `Contrato diz ${row.rent.toFixed(2)} €, os recibos mostram ${row.expectedRent.toFixed(2)} €. Verificar se é retenção na fonte (empresa retém ~25%) ou renda desatualizada.`,
      href: `/fracoes/${row.propertyId}`,
    });
  }

  // 3) Contratos sobrepostos na mesma fração: a mesma casa não pode estar arrendada duas vezes.
  const byProperty = new Map<string, Contract[]>();
  for (const c of contracts) {
    const list = byProperty.get(c.property_id) ?? [];
    list.push(c);
    byProperty.set(c.property_id, list);
  }
  for (const [propertyId, list] of byProperty) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        // Um contrato cessado sem data de fim não tem intervalo utilizável — ignorado.
        const aEnd = a.end_date ?? (a.status === "ativo" ? null : a.start_date);
        const bEnd = b.end_date ?? (b.status === "ativo" ? null : b.start_date);
        if (!overlaps(a.start_date, aEnd, b.start_date, bEnd)) continue;
        issues.push({
          kind: "contratos_sobrepostos",
          severity: "erro",
          title: name(propertyId),
          detail: `${a.tenant_name} (${a.start_date ?? "?"}) e ${b.tenant_name} (${b.start_date ?? "?"}) coincidem no tempo. Fechar o antigo com data de fim.`,
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
  for (const [propertyId, total] of quotaByProperty) {
    if (Math.abs(total - 100) <= QUOTA_TOLERANCE) continue;
    issues.push({
      kind: "quotas",
      severity: "erro",
      title: name(propertyId),
      detail: `As quotas somam ${total.toFixed(1)}% (deviam somar 100%). Afeta o IRS, não a ótica de família.`,
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

  // 7) Fichas de fração incompletas — bloqueiam o €/m² vs INE na página de Mercado (P0-2).
  for (const p of properties) {
    const missing: string[] = [];
    if (!p.area_m2) missing.push("área");
    if (!p.typology) missing.push("tipologia");
    if (!p.dicofre) missing.push("freguesia");
    if (!p.vpt) missing.push("VPT");
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

/** Agrupa por kind, pela ordem de KIND_ORDER (mais grave primeiro). */
export function groupByKind(issues: HealthIssue[]): Array<[string, HealthIssue[]]> {
  const map = new Map<string, HealthIssue[]>();
  for (const i of issues) map.set(i.kind, [...(map.get(i.kind) ?? []), i]);
  return KIND_ORDER.filter((k) => map.has(k)).map((k) => [k, map.get(k)!]);
}
