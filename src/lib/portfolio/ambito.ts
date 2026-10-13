import { quotasDeclarantes, shareOf, scopedExpense, type Ambito } from "../gestao";
import type { RawData } from "./load";
export function scopeRaw(
  raw: RawData,
  scope: Ambito,
  landlordId?: string,
): { raw: RawData; excluded: number } {
  const declarantes = quotasDeclarantes(raw.expenses, raw.owners);
  const shares = new Map(
    raw.properties.map((p) => [p.id, shareOf(p.id, raw.owners, raw.landlords, scope, landlordId)]),
  );
  const properties = raw.properties.filter((p) => shares.get(p.id) !== null);
  const ids = new Set(properties.map((p) => p.id));
  const contracts = raw.contracts
    .filter((c) => ids.has(c.property_id))
    .map((c) => ({ ...c, rent: Number(c.rent) * shares.get(c.property_id)! }));
  const contractShares = new Map(contracts.map((c) => [c.id, shares.get(c.property_id)!]));
  return {
    excluded: raw.properties.length - properties.length,
    raw: {
      ...raw,
      properties: properties.map((p) => ({
        ...p,
        vpt: p.vpt === null ? null : Number(p.vpt) * shares.get(p.id)!,
      })),
      contracts,
      payments: raw.payments
        .filter((p) => contractShares.has(p.contract_id))
        .map((p) => ({ ...p, amount: Number(p.amount) * contractShares.get(p.contract_id)! })),
      paymentsRecentes: raw.paymentsRecentes
        .filter((p) => contractShares.has(p.contract_id))
        .map((p) => ({ ...p, amount: Number(p.amount) * contractShares.get(p.contract_id)! })),
      rentUpdates: raw.rentUpdates
        .filter((u) => contractShares.has(u.contract_id))
        .map((u) => ({
          ...u,
          old_rent: u.old_rent === null ? null : Number(u.old_rent) * contractShares.get(u.contract_id)!,
          new_rent: Number(u.new_rent) * contractShares.get(u.contract_id)!,
        })),
      expenses: raw.expenses.flatMap((e) => {
        const value = scopedExpense(e, raw.owners, raw.landlords, scope, landlordId, declarantes);
        return value.amount === null
          ? []
          : [{ ...e, amount: value.amount, origem: value.estimated ? ("espelhada" as const) : e.origem }];
      }),
    },
  };
}
