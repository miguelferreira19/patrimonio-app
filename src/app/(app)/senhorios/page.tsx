import { LandlordFormButton } from "@/components/forms";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { getSession } from "@/lib/data";
import { currentMonthKey, fmtEur } from "@/lib/format";
import type {
  Contract,
  Expense,
  Landlord,
  Payment,
  Property,
  PropertyOwner,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<Property["status"], string> = {
  arrendado: "arrendada",
  vago: "vaga",
  outro: "outro",
};

function statusSummary(counts: Partial<Record<Property["status"], number>>): string {
  const parts = (["arrendado", "vago", "outro"] as const)
    .filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => `${counts[s]} ${STATUS_LABEL[s]}${counts[s]! > 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "sem frações";
}

export default async function SenhoriosPage() {
  const { supabase, isAdmin } = await getSession();
  const year = currentMonthKey().slice(0, 4);
  const yearStart = `${year}-01-01`;

  const [landlordsQ, ownersQ, propsQ, contractsQ, paymentsQ, expensesQ] = await Promise.all([
    supabase.from("landlords").select("*").order("name"),
    supabase.from("property_owners").select("*"),
    supabase.from("properties").select("id,name,status"),
    supabase.from("contracts").select("*").eq("status", "ativo"),
    supabase.from("payments").select("*").gte("ref_month", yearStart),
    supabase.from("expenses").select("*").gte("expense_date", yearStart),
  ]);

  const landlords = (landlordsQ.data ?? []) as Landlord[];
  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const properties = (propsQ.data ?? []) as Array<Pick<Property, "id" | "name" | "status">>;
  const contracts = (contractsQ.data ?? []) as Contract[];
  const payments = (paymentsQ.data ?? []) as Payment[];
  const expenses = (expensesQ.data ?? []) as Expense[];

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const contractById = new Map(contracts.map((c) => [c.id, c]));

  // Frações por senhorio (Set dedupe-a automaticamente) + quotas (só informativo).
  const propsByLandlord = new Map<string, Set<string>>();
  const quotasByLandlord = new Map<string, number[]>();
  for (const o of owners) {
    const set = propsByLandlord.get(o.landlord_id) ?? new Set<string>();
    set.add(o.property_id);
    propsByLandlord.set(o.landlord_id, set);

    const quotas = quotasByLandlord.get(o.landlord_id) ?? [];
    quotas.push(o.quota ?? 100);
    quotasByLandlord.set(o.landlord_id, quotas);
  }

  // Renda ativa POR INTEIRO, por fração (soma se houver mais de um contrato ativo na mesma fração).
  const activeRentByProperty = new Map<string, number>();
  for (const c of contracts) {
    activeRentByProperty.set(c.property_id, (activeRentByProperty.get(c.property_id) ?? 0) + c.rent);
  }

  // Recebido/despesas YTD POR INTEIRO, por fração — usados só no total da família.
  const receivedByProperty = new Map<string, number>();
  for (const p of payments) {
    const c = contractById.get(p.contract_id);
    if (!c) continue;
    receivedByProperty.set(c.property_id, (receivedByProperty.get(c.property_id) ?? 0) + p.amount);
  }
  const expensesByProperty = new Map<string, number>();
  let expensesLandlordGeral = 0; // despesas sem fração mas atribuídas a um senhorio (ex.: seguro pessoal)
  let expensesSemAtribuicao = 0; // despesas sem fração nem senhorio
  for (const e of expenses) {
    if (e.property_id) {
      expensesByProperty.set(e.property_id, (expensesByProperty.get(e.property_id) ?? 0) + e.amount);
    } else if (e.landlord_id) {
      expensesLandlordGeral += e.amount;
    } else {
      expensesSemAtribuicao += e.amount;
    }
  }

  interface LandlordVM {
    landlord: Landlord;
    nProps: number;
    statusCounts: Partial<Record<Property["status"], number>>;
    expectedMonthly: number;
    quotaAvg: number | null;
  }

  const rows: LandlordVM[] = landlords.map((l) => {
    const propIds = Array.from(propsByLandlord.get(l.id) ?? []);
    const statusCounts: Partial<Record<Property["status"], number>> = {};
    let expectedMonthly = 0;
    for (const pid of propIds) {
      const st = propertyById.get(pid)?.status ?? "outro";
      statusCounts[st] = (statusCounts[st] ?? 0) + 1;
      expectedMonthly += activeRentByProperty.get(pid) ?? 0;
    }
    const quotas = quotasByLandlord.get(l.id) ?? [];
    const quotaAvg = quotas.length > 0 ? quotas.reduce((a, b) => a + b, 0) / quotas.length : null;
    return { landlord: l, nProps: propIds.length, statusCounts, expectedMonthly, quotaAvg };
  });

  // ---- Total família: somado diretamente sobre as frações distintas (não sobre as
  // linhas por senhorio, que se somadas duplicariam as frações partilhadas). ----
  const familyPropertyIds = new Set(owners.map((o) => o.property_id));
  let rendaFamilia = 0;
  let recebidoFamilia = 0;
  let despesasFamilia = 0;
  for (const pid of familyPropertyIds) {
    rendaFamilia += activeRentByProperty.get(pid) ?? 0;
    recebidoFamilia += receivedByProperty.get(pid) ?? 0;
    despesasFamilia += expensesByProperty.get(pid) ?? 0;
  }
  despesasFamilia += expensesLandlordGeral;
  const liquidoFamilia = recebidoFamilia - despesasFamilia;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Senhorios"
        description="Valores por inteiro (ótica de família): as frações partilhadas contam uma única vez no total. As quotas de cada titular ficam registadas para o apoio ao IRS (fase futura)."
        actions={isAdmin && <LandlordFormButton />}
      />

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Senhorio</Th>
              <Th>NIF</Th>
              <Th className="text-right">Frações</Th>
              <Th>Por estado</Th>
              <Th className="text-right">Renda mensal (por inteiro)</Th>
              <Th className="text-right">Recebido {year}</Th>
              <Th className="text-right">Despesas {year}</Th>
              <Th className="text-right">Líquido {year}</Th>
              <Th className="text-right">Quota média</Th>
              {isAdmin && <Th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.landlord.id} className="hover:bg-zinc-50">
                <Td className="font-medium">{r.landlord.name}</Td>
                <Td className="font-mono text-xs">{r.landlord.nif ?? "n/d"}</Td>
                <Td className="text-right tabular-nums">{r.nProps}</Td>
                <Td className="text-xs text-zinc-500">{statusSummary(r.statusCounts)}</Td>
                <Td className="text-right tabular-nums">{fmtEur(r.expectedMonthly)}</Td>
                <Td className="text-right tabular-nums text-zinc-400">n/d</Td>
                <Td className="text-right tabular-nums text-zinc-400">n/d</Td>
                <Td className="text-right tabular-nums text-zinc-400">n/d</Td>
                <Td className="text-right tabular-nums text-zinc-500">
                  {r.quotaAvg !== null ? `${r.quotaAvg.toLocaleString("pt-PT")}%` : "n/d"}
                </Td>
                {isAdmin && (
                  <Td>
                    <LandlordFormButton landlord={r.landlord} />
                  </Td>
                )}
              </tr>
            ))}
            <tr className="bg-zinc-50 font-semibold">
              <Td className="border-t border-zinc-200">Total família</Td>
              <Td className="border-t border-zinc-200" />
              <Td className="border-t border-zinc-200 text-right tabular-nums">{familyPropertyIds.size}</Td>
              <Td className="border-t border-zinc-200" />
              <Td className="border-t border-zinc-200 text-right tabular-nums">{fmtEur(rendaFamilia)}</Td>
              <Td className="border-t border-zinc-200 text-right tabular-nums">{fmtEur(recebidoFamilia)}</Td>
              <Td className="border-t border-zinc-200 text-right tabular-nums text-red-700">
                {despesasFamilia > 0 ? `−${fmtEur(despesasFamilia)}` : fmtEur(0)}
              </Td>
              <Td className="border-t border-zinc-200 text-right tabular-nums text-teal-700">
                {fmtEur(liquidoFamilia)}
              </Td>
              <Td className="border-t border-zinc-200" />
              {isAdmin && <Td className="border-t border-zinc-200" />}
            </tr>
          </tbody>
        </Table>
        {expensesSemAtribuicao > 0 && (
          <p className="mt-2 text-xs text-zinc-500">
            Nota: {fmtEur(expensesSemAtribuicao)} de despesas gerais (sem fração/senhorio) não
            estão incluídas no total.
          </p>
        )}
      </Card>
    </div>
  );
}
