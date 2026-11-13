import { nomeProprio } from "@/lib/format";
import { MINUTAS, minutaAcordo, type MinutaDados } from "@/lib/minutas";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { dividaDaCarta, planoDoAcordo } from "@/lib/portfolio/cartas-diario";
import { devedores } from "@/lib/portfolio/inquilinos";
import { nomeDaFracao } from "@/lib/portfolio/predios";

export const TIPOS_DE_CARTA = ["lembrete", "interpelacao", "resolucao", "acordo", "oposicao"] as const;
export type TipoDeCarta = typeof TIPOS_DE_CARTA[number];
export type QueryCarta = { prestacoes?: string; primeira?: string };

export function tipoDeCarta(tipo: string): tipo is TipoDeCarta {
  return TIPOS_DE_CARTA.some((t) => t === tipo);
}

export async function carregarCarta(contractId: string) {
  const { snap, raw } = await getSnapshotComRaw();
  const contract = raw.contracts.find((c) => c.id === contractId);
  const property = raw.properties.find((p) => p.id === contract?.property_id);
  if (!contract || !property) return null;
  const titular = raw.owners.filter((o) => o.property_id === property.id).sort((a, b) => b.quota - a.quota)[0];
  const landlord = raw.landlords.find((l) => l.id === titular?.landlord_id);
  const atraso = devedores(snap).flatMap((d) => d.contratos).find((c) => c.contract.id === contractId);
  const dados: MinutaDados | null = landlord ? {
    senhorio: nomeProprio(landlord.name), senhorioNif: landlord.nif,
    inquilino: nomeProprio(contract.tenant_name), inquilinoNif: contract.tenant_nif,
    morada: [property.address, property.postal_code, property.parish, property.municipality]
      .filter(Boolean).join(", ") || nomeDaFracao(property),
    fracaoRef: nomeDaFracao(property), contratoNo: contract.pf_contract_no,
    inicio: contract.start_date, renda: contract.rent, hoje: snap.hoje,
    fimContrato: contract.expected_end_date ?? contract.end_date,
    antecedenciaDias: contract.notice_days_landlord, divida: dividaDaCarta(atraso),
  } : null;
  return { contract, property, dados };
}

export function construirCarta(tipo: TipoDeCarta, dados: MinutaDados, query: QueryCarta) {
  if (tipo !== "acordo") return MINUTAS[tipo].construir(dados, dados.divida);
  return minutaAcordo(dados, { divida: dados.divida?.total ?? 0, ...planoDoAcordo(query, dados.hoje) });
}
