import { getSnapshotComRaw } from ".";
import { getManagement, getReceiptsInPeriod } from "./gestao-load";
import { horizontePorContrato } from "../arrears";
import { monthsBetween, monthStatement, shareOf, type Ambito } from "../gestao";
import { todayISO } from "../format";
import { nomeDaFracao } from "./predios";
export type OperationalQuery = {
  de?: string;
  ate?: string;
  ambito?: string;
  senhorio?: string;
  q?: string;
  estado?: string;
  ordem?: string;
  contrato?: string;
  imovel?: string;
};
export function operationalPeriod(q: OperationalQuery) {
  const month = todayISO().slice(0, 7);
  const valid = (s?: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s ?? "");
  const from = (valid(q.de) ? q.de : month) + "-01";
  const to = (valid(q.ate) ? q.ate : valid(q.de) ? q.de : month) + "-01";
  return { from, to, months: monthsBetween(from, to) };
}
export async function operationalData(q: OperationalQuery) {
  const period = operationalPeriod(q);
  const [{ raw, snap, today }, management, receipts] = await Promise.all([
    getSnapshotComRaw(),
    getManagement(),
    getReceiptsInPeriod(period.from, period.to),
  ]);
  const scope: Ambito = ["carteira", "proprietario"].includes(q.ambito ?? "")
    ? (q.ambito as Ambito)
    : "inteiro";
  const horizons = horizontePorContrato(
    raw.receiptsRecentes.flatMap((r) =>
      r.landlord_id ? [{ ...r, landlord_id: r.landlord_id, issue_date: r.issue_date ?? null }] : [],
    ),
    today,
  ).porContrato;
  const rows = raw.contracts.flatMap((contract) => {
    const property = raw.properties.find((p) => p.id === contract.property_id);
    if (!property) return [];
    if (q.imovel && property.id !== q.imovel) return [];
    const share = shareOf(property.id, raw.owners, raw.landlords, scope, q.senhorio);
    if (scope === "proprietario" && share === null) return [];
    if (q.contrato && contract.id !== q.contrato) return [];
    if (
      q.q &&
      !`${nomeDaFracao(property)} ${contract.tenant_name} ${contract.tenant_nif ?? ""} ${property.matriz_article}`
        .toLocaleLowerCase("pt-PT")
        .includes(q.q.toLocaleLowerCase("pt-PT"))
    )
      return [];
    return period.months.flatMap((month) => {
      const statement = monthStatement({
        contract,
        month,
        today: snap.hoje,
        horizon: horizons.get(contract.id) ?? null,
        updates: raw.rentUpdates,
        receipts,
        ...management,
      });
      if (statement.status === "fora" && !statement.documented && !statement.confirmed) return [];
      if (q.estado && statement.status !== q.estado) return [];
      return [
        {
          contract,
          property,
          share,
          statement,
          next: management.cases.find((c) => c.contract_id === contract.id && c.status !== "concluido"),
        },
      ];
    });
  });
  rows.sort((a, b) =>
    q.ordem === "saldo"
      ? b.statement.pending - a.statement.pending
      : q.ordem === "inquilino"
        ? a.contract.tenant_name.localeCompare(b.contract.tenant_name, "pt")
        : nomeDaFracao(a.property).localeCompare(nomeDaFracao(b.property), "pt") ||
          a.statement.month.localeCompare(b.statement.month),
  );
  return { ...period, raw, snap, management, receipts, scope, rows, horizons };
}
