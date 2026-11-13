import type { ContextoDoControlo, Sinal, TipoDeSinal } from "@/lib/controlo";
import { ultimoContacto, type EventoDoDiario } from "@/lib/portfolio/diario";
import { chaveDoInquilino, type Devedor } from "@/lib/portfolio/inquilinos";
import type { Contract, InsightState, RentUpdate } from "@/lib/types";

export const FILTROS: Array<{ id: string; rotulo: string; tipos: TipoDeSinal[] }> = [
  { id: "por_ver", rotulo: "Por ver", tipos: [] },
  { id: "emissao", rotulo: "Emissão", tipos: ["emissao_tardia", "lote", "data_estranha"] },
  { id: "anulados", rotulo: "Anulados", tipos: ["anulado_sem_substituto", "anulado_reemitido"] },
  { id: "valores", rotulo: "Valores", tipos: ["valor_diferente", "retencao_inconsistente", "mes_saltado"] },
  { id: "tolerancia", rotulo: "Tolerância", tipos: ["atraso_sem_contacto"] },
];

export function eEmpresa(c: Pick<Contract, "tenant_nif" | "tenant_name">): boolean {
  return /^[569]/.test(c.tenant_nif?.trim() ?? "") || /\b(?:lda|unipessoal)\b|\bs\s*\.\s*a\s*\./i.test(c.tenant_name);
}

export function contextoDoControlo(
  contratos: Contract[], atualizacoes: RentUpdate[], dividas: Devedor[],
  diario: EventoDoDiario[], hoje: string,
): ContextoDoControlo {
  const ultimoContactoPorContrato = new Map<string, string>();
  for (const c of contratos) {
    const ultimo = ultimoContacto(diario.filter((e) => e.contratoId === c.id && e.dia <= hoje));
    if (ultimo) ultimoContactoPorContrato.set(c.id, ultimo.dia);
  }
  return {
    hoje, ultimoContactoPorContrato,
    contratos: contratos.map((c) => ({ ...c, empresa: eEmpresa(c),
      atualizacoes: atualizacoes.filter((a) => a.contract_id === c.id) })),
    mesesEmAtrasoPorContrato: new Map(dividas.flatMap((d) => d.contratos.map((c) => [c.contract.id, c.meses]))),
  };
}

export function listaDeSinais(sinais: Sinal[], marcados: InsightState[], filtro: string) {
  const estados = new Map(marcados.filter((e) => e.kind === "controlo" && e.dismissed_at)
    .map((e) => [e.subject, e.note === "Justificado" ? "Justificado" : "Visto"]));
  const contagens = Object.fromEntries(FILTROS.map((f) => [f.id,
    sinais.filter((s) => f.id === "por_ver" ? !estados.has(s.id) : f.tipos.includes(s.tipo)).length]));
  const ativo = FILTROS.find((f) => f.id === filtro) ?? FILTROS[0];
  return { estados, contagens, ativo: ativo.id,
    visiveis: sinais.filter((s) => ativo.id === "por_ver" ? !estados.has(s.id) : ativo.tipos.includes(s.tipo)) };
}

export function ligacaoDoContrato(numero: string, contratos: Contract[]): string | undefined {
  const c = contratos.find((c) => c.pf_contract_no === numero);
  return c ? `/inquilinos/${encodeURIComponent(chaveDoInquilino(c))}` : undefined;
}

