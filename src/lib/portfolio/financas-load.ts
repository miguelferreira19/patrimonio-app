import { getSnapshotComRaw } from "./index";
import { nomeProprio } from "../format";
import { aimiPorSenhorio, prazosDoAno, rendasDosAtivos } from "./agenda";
import { carregarAno } from "./ano";
import { nomeDaFracao } from "./predios";
import { despesasEmFalta, poupancaPorContrato, resumoDaPoupanca } from "./poupanca";

export async function carregarCalendario(feitos: Set<string>) {
  const { raw, snap } = await getSnapshotComRaw();
  const ano = Number(snap.hoje.slice(0, 4));
  const entrada = {
    hoje: snap.hoje, despesas: raw.expenses,
    senhorios: raw.landlords.map((l) => ({ ...l, name: nomeProprio(l.name) })), titulares: raw.owners,
    aimi: aimiPorSenhorio(raw.landlords, raw.owners, raw.properties)
      .map((a) => ({ ...a, senhorio: nomeProprio(a.senhorio) })),
    rendas: rendasDosAtivos(snap.correntes.map((a) => ({
      ...a, property: { ...a.property, name: nomeDaFracao(a.property) },
      activeContract: a.activeContract ? { ...a.activeContract, tenant_name: nomeProprio(a.activeContract.tenant_name) } : null,
    }))), feitos,
  };
  return { hoje: snap.hoje, prazos: [
    ...prazosDoAno({ ...entrada, ano }), ...prazosDoAno({ ...entrada, ano: ano + 1 }),
  ] };
}

export async function carregarPoupanca() {
  const { snap, raw } = await getSnapshotComRaw();
  const ano = Number(snap.hoje.slice(0, 4)) - 1;
  const dados = await carregarAno(ano);
  const linhas = poupancaPorContrato(dados.porSenhorio).sort((a, b) =>
    Number(a.falta !== null) - Number(b.falta !== null) || b.eurosPorAno - a.eurosPorAno);
  return {
    ano, linhas, resumo: resumoDaPoupanca(linhas), porSenhorio: dados.porSenhorio,
    propriedades: raw.properties,
    despesas: despesasEmFalta(raw.expenses, snap.correntes.map((a) => a.property.id), ano),
  };
}
