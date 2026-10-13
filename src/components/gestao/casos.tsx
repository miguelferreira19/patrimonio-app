// TAREFAS (V5; uma só lista desde o plano de clareza, Fase 5). Tarefas, diligências de
// cobrança, manutenção e vagas eram três páginas e três entradas de menu, todas vazias; agora
// são uma lista com o tipo como etiqueta. /manutencao e /vagas redirecionam para aqui.

import Link from "next/link";
import { Badge, Button, Field, Input, Select, buttonClass, cn } from "@/components/ui";
import { Money } from "@/components/kit/money";
import { CaseForm } from "./forms";
import { CASE_STATUS_LABEL, AVAILABILITY_LABEL, type CaseKind, type ManagementCase } from "@/lib/gestao";
import { getManagement } from "@/lib/portfolio/gestao-load";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { getSession } from "@/lib/data";
import { fmtDate, todayISO } from "@/lib/format";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import { isCurrentProperty } from "@/lib/calc";

export type CaseQuery = { q?: string; estado?: string; responsavel?: string; imovel?: string; prioridade?: string; tipo?: string };

const TIPOS: Array<[CaseKind | "", string]> = [
  ["", "Todas"],
  ["tarefa", "Tarefas e cobranças"],
  ["manutencao", "Manutenção"],
  ["vaga", "Vagas"],
];
const ETIQUETA: Record<CaseKind, string> = { tarefa: "Tarefa", cobranca: "Cobrança", manutencao: "Manutenção", vaga: "Vaga" };

export async function CasesPage({ q }: { q: CaseQuery }) {
  const [{ raw }, management, { isAdmin }] = await Promise.all([getSnapshotComRaw(), getManagement(), getSession()]);
  const kind = (TIPOS.some(([k]) => k && k === q.tipo) ? q.tipo : null) as CaseKind | null;
  const properties = raw.properties.map((p) => ({ id: p.id, label: nomeDaFracao(p) }));
  const contracts = raw.contracts.map((c) => ({ id: c.id, label: c.tenant_name, propertyId: c.property_id }));
  const nomeDe = (id: string | null) => properties.find((p) => p.id === id)?.label;
  const doTipo = (c: ManagementCase) => !kind || (kind === "tarefa" ? ["tarefa", "cobranca"].includes(c.kind) : c.kind === kind);
  const doEstado = (c: ManagementCase) => q.estado === "todos" || (q.estado ? c.status === q.estado : c.status !== "concluido");
  const pesquisa = (c: ManagementCase) =>
    !q.q || `${c.title} ${c.description} ${c.next_step} ${nomeDe(c.property_id)}`.toLowerCase().includes(q.q.toLowerCase());
  const cases = management.cases
    .filter((c) => doTipo(c) && doEstado(c) && pesquisa(c))
    .filter((c) => (!q.imovel || c.property_id === q.imovel) && (!q.prioridade || c.priority === q.prioridade) && (!q.responsavel || c.responsible === q.responsavel))
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const responsaveis = [...new Set(management.cases.map((c) => c.responsible).filter((r): r is string => !!r))];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-tinta md:text-[30px]">Tarefas</h1>
      <nav className="flex flex-wrap gap-2" aria-label="Tipo de tarefa">
        {TIPOS.map(([k, label]) => (
          <Link
            key={k || "todas"}
            href={k ? `/tarefas?tipo=${k}` : "/tarefas"}
            aria-current={(kind ?? "") === k ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
              (kind ?? "") === k ? "border-tinta bg-tinta text-papel" : "border-regua-forte text-tinta-2 hover:bg-vellum",
            )}
          >
            {label} · {management.cases.filter((c) => c.status !== "concluido" && (!k || (k === "tarefa" ? ["tarefa", "cobranca"].includes(c.kind) : c.kind === k))).length}
          </Link>
        ))}
      </nav>

      {isAdmin && <CaseForm kind={kind ?? "tarefa"} properties={properties} contracts={contracts} />}

      {cases.length === 0 ? (
        <p className="rounded-2xl border border-regua bg-carta px-5 py-6 text-sm text-tinta-2">Nada em aberto.</p>
      ) : (
        <ul className="divide-y divide-regua overflow-hidden rounded-2xl border border-regua bg-carta">
          {cases.map((c) => (
            <Linha key={c.id} c={c} imovel={nomeDe(c.property_id)} realizado={raw.expenses.filter((e) => e.case_id === c.id).reduce((n, e) => n + Number(e.amount), 0)} />
          ))}
        </ul>
      )}

      {kind === "vaga" && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Sem contrato ativo</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {raw.properties
              // A regra de "fração corrente" de toda a app: terrenos (-R-) e vendidos não são vagas.
              .filter((p) => isCurrentProperty(p) && !raw.contracts.some((c) => c.property_id === p.id && c.status === "ativo"))
              .map((p) => (
                <li key={p.id}>
                  <Link href={`/fracoes/${p.id}`} className="block rounded-xl border border-regua bg-carta px-3 py-2.5 text-[13px] font-medium text-tinta hover:bg-vellum">
                    {nomeDaFracao(p)}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      <details className="rounded-2xl border border-regua bg-carta p-4">
        <summary className="cursor-pointer text-sm font-semibold text-acao">Filtrar</summary>
        <form action="/tarefas" className="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kind && <input type="hidden" name="tipo" value={kind} />}
          <Field label="Pesquisar"><Input name="q" type="search" defaultValue={q.q} /></Field>
          <Field label="Estado">
            <Select name="estado" defaultValue={q.estado ?? ""}>
              <option value="">Em aberto</option>
              {Object.entries(CASE_STATUS_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              <option value="todos">Todos, incluindo concluídos</option>
            </Select>
          </Field>
          <Field label="Imóvel">
            <Select name="imovel" defaultValue={q.imovel ?? ""}>
              <option value="">Todos</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </Field>
          <Field label="Responsável">
            <Select name="responsavel" defaultValue={q.responsavel ?? ""}>
              <option value="">Todos</option>
              {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Prioridade">
            <Select name="prioridade" defaultValue={q.prioridade ?? ""}>
              <option value="">Todas</option>
              {["baixa", "normal", "alta", "urgente"].map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Button type="submit">Aplicar</Button>
        </form>
      </details>
      <Link href="/contratos" className={buttonClass({ variant: "outline" })}>Contratos e prazos</Link>
    </div>
  );
}

function Linha({ c, imovel, realizado }: { c: ManagementCase; imovel?: string; realizado: number }) {
  const atrasada = c.due_date && c.due_date < todayISO() && c.status !== "concluido";
  return (
    <li className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 md:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutro">{ETIQUETA[c.kind]}</Badge>
          <Link href={`/gestao/${c.id}`} className="text-[15px] font-semibold text-tinta hover:text-acao">{c.title}</Link>
        </div>
        <p className="mt-1 text-sm text-tinta-2">
          {imovel || "Sem imóvel"} · {c.responsible || "sem responsável"}
          {c.next_step ? ` · ${c.next_step}` : ""}
        </p>
        {c.kind === "vaga" && (
          <p className="mt-1 text-xs text-tinta-2">
            {c.availability_state ? AVAILABILITY_LABEL[c.availability_state] : "Disponibilidade por confirmar"} · renda objetivo <Money value={c.target_rent} decimals={2} />
          </p>
        )}
        {c.kind === "manutencao" && (
          <p className="mt-1 text-xs text-tinta-2">
            Aprovado <Money value={c.approved_budget} decimals={2} /> · realizado <Money value={realizado} decimals={2} />
          </p>
        )}
      </div>
      <div className="space-y-1.5 text-right">
        <Badge tone={c.priority === "urgente" ? "atencao" : "neutro"}>{CASE_STATUS_LABEL[c.status]}</Badge>
        <p className={cn("text-sm", atrasada ? "text-atencao" : "text-tinta-2")}>{c.due_date ? `até ${fmtDate(c.due_date)}` : "sem prazo"}</p>
      </div>
    </li>
  );
}
