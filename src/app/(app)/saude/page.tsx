import Link from "next/link";
import { AlertTriangle, CheckCircle2, ListChecks, XCircle } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { computeArrears } from "@/lib/arrears";
import { fetchAllPayments, getSession } from "@/lib/data";
import { todayISO } from "@/lib/format";
import {
  KIND_LABEL,
  SEVERITY_LABEL,
  computeHealth,
  countBySeverity,
  groupByKind,
  type HealthSeverity,
} from "@/lib/health";
import type { Contract, Property, PropertyOwner } from "@/lib/types";

export const dynamic = "force-dynamic";

const TONE: Record<HealthSeverity, "red" | "amber" | "zinc"> = {
  erro: "red",
  aviso: "amber",
  info: "zinc",
};

export default async function SaudePage() {
  const { supabase, isAdmin } = await getSession();

  if (!isAdmin) {
    return (
      <Card>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Área reservada ao administrador.</p>
      </Card>
    );
  }

  const [propsQ, contractsQ, ownersQ, payments, orphansQ] = await Promise.all([
    supabase.from("properties").select("*"),
    supabase.from("contracts").select("*"),
    supabase.from("property_owners").select("*"),
    fetchAllPayments(supabase),
    // Contagem, não as linhas: os recibos passam das 5000 e aqui só interessa quantos ficaram
    // sem contrato associado.
    supabase.from("receipts").select("id", { count: "exact", head: true }).is("contract_id", null),
  ]);

  const properties = (propsQ.data ?? []) as Property[];
  const contracts = (contractsQ.data ?? []) as Contract[];
  const owners = (ownersQ.data ?? []) as PropertyOwner[];

  const { rows: arrears } = computeArrears(
    contracts.filter((c) => c.status === "ativo"),
    payments,
    new Date(),
  );

  const issues = computeHealth({
    properties,
    contracts,
    owners,
    arrears,
    orphanReceipts: orphansQ.count ?? 0,
    today: todayISO(),
  });
  const counts = countBySeverity(issues);
  const groups = groupByKind(issues);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Saúde dos dados"
        description="Verificações automáticas à carteira. Esta página só lê: não altera nada."
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Erros"
          value={counts.erro}
          sub="dados que produzem números errados"
          tone={counts.erro > 0 ? "red" : "green"}
          icon={XCircle}
        />
        <StatCard
          label="Avisos"
          value={counts.aviso}
          sub="a confirmar, pode ser legítimo"
          tone={counts.aviso > 0 ? "amber" : "green"}
          icon={AlertTriangle}
        />
        <StatCard
          label="A completar"
          value={counts.info}
          sub="campos por preencher"
          icon={ListChecks}
        />
      </div>

      {groups.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2}>
            Nenhuma anomalia encontrada na carteira.
          </EmptyState>
        </Card>
      ) : (
        groups.map(([kind, list]) => (
          <Card
            key={kind}
            title={KIND_LABEL[kind] ?? kind}
            subtitle={`${list.length} ${list.length === 1 ? "ocorrência" : "ocorrências"}`}
            actions={<Badge tone={TONE[list[0].severity]}>{SEVERITY_LABEL[list[0].severity]}</Badge>}
          >
            <Table>
              <thead>
                <tr>
                  <Th className="w-56">Fração</Th>
                  <Th>Detalhe</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((issue, i) => (
                  <tr key={`${kind}-${i}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                    <Td>
                      {issue.href ? (
                        <Link href={issue.href} className="font-medium text-teal-700 hover:underline dark:text-teal-400">
                          {issue.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{issue.title}</span>
                      )}
                    </Td>
                    <Td className="whitespace-normal text-zinc-600 dark:text-zinc-400">{issue.detail}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        As verificações de contratos parados e de renda desalinhada usam a mesma base da página de{" "}
        <Link href="/atrasos" className="text-teal-700 hover:underline dark:text-teal-400">
          Atrasos
        </Link>
        .
      </p>
    </div>
  );
}
