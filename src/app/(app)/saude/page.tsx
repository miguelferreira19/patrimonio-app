import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Badge, Card, EmptyState, buttonClass, cn } from "@/components/ui";
import { getSession } from "@/lib/data";
import { getSnapshot } from "@/lib/portfolio";
import {
  KIND_LABEL,
  SEVERITY_LABEL,
  computeHealth,
  countBySeverity,
  groupByKind,
  type HealthSeverity,
} from "@/lib/health";
import type { PropertyOwner } from "@/lib/types";
import { nomeDaFracao } from "@/lib/portfolio/predios";

export const dynamic = "force-dynamic";

const TONE: Record<HealthSeverity, "red" | "amber" | "zinc"> = {
  erro: "red",
  aviso: "amber",
  info: "zinc",
};

export default async function SaudePage({ searchParams }: { searchParams: Promise<{ gravidade?: string }> }) {
  const { gravidade } = await searchParams;
  const { isAdmin } = await getSession();

  // Admin-only com REDIRECT, nao com um cartao "area reservada": e a regra escrita no
  // CLAUDE.md e o que /analise e /inquilinos ja faziam. Tres paginas a divergir do documento
  // e o que faz o proximo a ler o repo confiar numa guarda que nao existe como pensa.
  if (!isAdmin) {
    redirect("/");
  }

  // Fase 1: era o TERCEIRO sitio a correr `computeArrears` sobre o historico completo no
  // mesmo request (dashboard, Atrasos e aqui). Agora le o snapshot.
  //
  // Nota sobre equivalencia: o snapshot calcula os atrasos so sobre contratos de fracoes
  // CORRENTES, enquanto esta pagina os calculava sobre todos os ativos. Nao muda nada,
  // porque `computeHealth` comeca por descartar terrenos e vendidos e tudo o que os
  // referencia -- essas linhas eram calculadas e atiradas fora.
  const snap = await getSnapshot();
  const nomePorDestino = new Map(snap.ativos.map((a) => [`/fracoes/${a.property.id}`, nomeDaFracao(a.property)]));

  const owners: PropertyOwner[] = snap.ativos.flatMap((a) =>
    a.titulares.map((t) => ({
      property_id: a.property.id,
      landlord_id: t.landlord.id,
      quota: t.quota,
    })),
  );

  const issues = computeHealth({
    properties: snap.ativos.map((a) => a.property),
    contracts: snap.ativos.flatMap((a) => a.contracts),
    owners,
    arrears: snap.arrears.rows,
    orphanReceipts: snap.cobertura.recibosOrfaos,
    rendaObservada: snap.rendaObservadaPorContrato,
    today: snap.hoje,
  });
  const counts = countBySeverity(issues);
  const filtro = ["erro", "aviso", "info"].includes(gravidade ?? "") ? gravidade as HealthSeverity : null;
  const visiveis = filtro ? issues.filter((i) => i.severity === filtro) : issues;
  const groups = groupByKind(visiveis);

  return (
    <div className="space-y-4">
      <header><h1 className="text-2xl font-semibold tracking-[-0.02em] md:text-[30px]">Verificar os dados</h1><p className="mt-2 text-sm text-tinta-2">Começa pelos erros, depois confirma os avisos. Abre uma ocorrência para consultar a ficha.</p></header>
      <nav aria-label="Gravidade das ocorrências" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([null, "erro", "aviso", "info"] as const).map((g) => <Link key={g ?? "todos"} href={g ? `/saude?gravidade=${g}` : "/saude"} aria-current={filtro === g ? "page" : undefined} className={cn("rounded-2xl border bg-carta p-4 transition-colors hover:border-regua-forte", filtro === g ? "border-tinta" : "border-regua")}><p className="text-sm text-tinta-2">{g === null ? "Todas" : g === "erro" ? "Erros" : g === "aviso" ? "Avisos" : "A completar"}</p><p className={cn("mt-2 text-2xl font-semibold tabular-nums", g === "erro" && counts.erro > 0 ? "text-perda" : g === "aviso" && counts.aviso > 0 ? "text-atencao" : "text-tinta")}>{g === null ? issues.length : counts[g]}</p><p className="mt-1 text-xs text-tinta-3">{g === null ? "ocorrências na carteira" : g === "erro" ? "podem afetar os números" : g === "aviso" ? "a confirmar" : "informação em falta"}</p></Link>)}
      </nav>

      {groups.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2}>
            {filtro ? "Nenhuma ocorrência com esta gravidade." : "Nenhuma anomalia encontrada na carteira."}
            {filtro && <Link href="/saude" className={buttonClass({ variant: "outline", className: "mt-3" })}>Ver todas</Link>}
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
            <ul className="divide-y divide-regua">
                {list.map((issue, i) => (
                  <li key={`${kind}-${i}`} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {issue.href ? (
                        <Link href={issue.href} className="font-medium text-acao hover:underline">
                          {nomePorDestino.get(issue.href) ?? issue.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-tinta-2">{issue.title}</span>
                      )}
                      <Badge tone={TONE[issue.severity]}>{SEVERITY_LABEL[issue.severity]}</Badge>
                    </div>
                    <p className="mt-1.5 max-w-[75ch] text-sm leading-relaxed text-tinta-2">{issue.detail}</p>
                    {issue.href && <Link href={issue.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-acao underline">Consultar e corrigir</Link>}
                  </li>
                ))}
            </ul>
          </Card>
        ))
      )}

      <p className="text-xs text-tinta-3">
        As verificações de contratos parados e de renda desalinhada usam a mesma base da página de{" "}
        <Link href="/imoveis?f=atraso" className="text-acao hover:underline">
          Atrasos
        </Link>
        .
      </p>
    </div>
  );
}
