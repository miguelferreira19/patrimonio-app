import Link from "next/link";
import { notFound } from "next/navigation";
import { getManagement, getOperationHistory } from "@/lib/portfolio/gestao-load";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { getSession } from "@/lib/data";
import { CASE_STATUS_LABEL, AVAILABILITY_LABEL } from "@/lib/gestao";
import { Lede } from "@/components/kit/lede";
import { Money } from "@/components/kit/money";
import { Card, Badge, buttonClass } from "@/components/ui";
import { CaseForm, EventForm, CaseExpenseForm } from "@/components/gestao/forms";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import { fmtDate, todayISO } from "@/lib/format";
import { BUCKET, partirCaminho } from "@/lib/documentos";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [m, { raw }, session, history] = await Promise.all([
    getManagement(),
    getSnapshotComRaw(),
    getSession(),
    getOperationHistory("management_cases", id),
  ]);
  const c = m.cases.find((c) => c.id === id);
  if (!c) notFound();
  const property = raw.properties.find((p) => p.id === c.property_id);
  const contract = raw.contracts.find((ct) => ct.id === c.contract_id);
  const expenses = raw.expenses.filter((e) => e.case_id === id);
  const total = expenses.reduce((n, e) => n + Number(e.amount), 0);
  const documents = c.document_paths.length
    ? await session.supabase.storage.from(BUCKET).createSignedUrls(c.document_paths, 3600)
    : null;
  const days =
    c.vacancy_start && (c.status !== "concluido" || c.vacancy_end)
      ? Math.max(0, (Date.parse(c.vacancy_end || todayISO()) - Date.parse(c.vacancy_start)) / 86400000)
      : null;
  return (
    <div className="space-y-6">
      <Link
        href={c.kind === "manutencao" ? "/manutencao" : c.kind === "vaga" ? "/vagas" : "/tarefas"}
        className={buttonClass({ variant: "ghost" })}
      >
        Voltar à lista
      </Link>
      <Lede title={c.title}>
        {property ? nomeDaFracao(property) : "Sem imóvel associado"}
        {contract ? ` · ${contract.tenant_name}` : ""}
      </Lede>
      <div className="flex flex-wrap gap-3">
        <Badge>{CASE_STATUS_LABEL[c.status]}</Badge>
        <Badge tone={c.priority === "urgente" ? "atencao" : "neutro"}>{c.priority}</Badge>
        {property && (
          <Link href={`/fracoes/${property.id}`} className="text-sm text-acao underline">
            Abrir imóvel
          </Link>
        )}
        {contract && (
          <Link href={`/cobrancas/${contract.id}`} className="text-sm text-acao underline">
            Consultar pagamentos
          </Link>
        )}
      </div>
      <dl className="grid gap-4 border-y border-regua py-5 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-tinta-2">Responsável</dt>
          <dd className="mt-1 font-medium">{c.responsible || "Por atribuir"}</dd>
        </div>
        <div>
          <dt className="text-sm text-tinta-2">Prazo / próxima data</dt>
          <dd className="mt-1 font-medium">{c.due_date ? fmtDate(c.due_date) : "Por definir"}</dd>
        </div>
        <div>
          <dt className="text-sm text-tinta-2">Próximo passo</dt>
          <dd className="mt-1 font-medium">{c.next_step || "Por definir"}</dd>
        </div>
      </dl>
      {c.description && (
        <p className="max-w-[72ch] whitespace-pre-wrap text-sm leading-relaxed">{c.description}</p>
      )}
      {c.kind === "manutencao" && (
        <Card title="Orçamento e custos">
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              ["Proposto", c.budget],
              ["Aprovado", c.approved_budget],
              ["Realizado · despesas ligadas", total],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-sm text-tinta-2">{label}</dt>
                <dd className="mt-2">
                  <Money value={value == null ? null : Number(value)} escala="xl" decimals={2} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-tinta-2">
            Fornecedor: {c.supplier || "Por escolher"}. Orçamentos não entram nas despesas realizadas.
          </p>
          {expenses.map((e) => (
            <p key={e.id} className="mt-2 text-sm">
              {fmtDate(e.expense_date)} · {e.description} · <Money value={Number(e.amount)} decimals={2} />
            </p>
          ))}
          {session.isAdmin && (
            <div className="mt-4">
              <CaseExpenseForm caseId={id} />
              <Link
                href={`/despesas?imovel=${c.property_id}`}
                className="mt-3 inline-flex min-h-11 items-center text-sm text-acao underline"
              >
                Associar uma despesa já registada
              </Link>
            </div>
          )}
        </Card>
      )}
      {c.kind === "vaga" && (
        <Card title="Disponibilidade e oportunidade">
          <p className="text-sm">
            {c.availability_state ? AVAILABILITY_LABEL[c.availability_state] : "Por confirmar"} · disponível a
            partir de {fmtDate(c.available_from)}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm">{c.preparation || "Preparação por definir"}</p>
          <p className="mt-3 text-sm text-tinta-2">
            Renda objetivo mensal: <Money value={c.target_rent} decimals={2} /> · oportunidade estimada no
            período:{" "}
            <Money
              value={
                days !== null && c.target_rent !== null ? (days / 30.4375) * Number(c.target_rent) : null
              }
              decimals={2}
            />
            .
          </p>
          <p className="mt-1 text-xs text-tinta-2">
            {days === null
              ? "Período da vaga incompleto; estimativa indisponível."
              : `${fmtDate(c.vacancy_start)} a ${fmtDate(c.vacancy_end || todayISO())}; cálculo pela renda objetivo e dias / 30,4375. Não é perda financeira confirmada.`}
          </p>
          {c.listing_url && (
            <a
              href={c.listing_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-11 items-center text-sm text-acao underline"
            >
              Abrir anúncio
            </a>
          )}
          <h3 className="mt-5 text-sm font-semibold">Histórico de ocupação registado</h3>
          {raw.contracts
            .filter((ct) => ct.property_id === c.property_id)
            .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))
            .map((ct) => (
              <p key={ct.id} className="mt-2 text-sm text-tinta-2">
                {ct.tenant_name} · {fmtDate(ct.start_date)} a{" "}
                {ct.end_date
                  ? fmtDate(ct.end_date)
                  : ct.status === "ativo"
                    ? "ocupação atual"
                    : "fim desconhecido"}
              </p>
            ))}
        </Card>
      )}
      {session.isAdmin && (
        <>
          <CaseForm
            kind={c.kind}
            initial={c}
            properties={raw.properties.map((p) => ({ id: p.id, label: nomeDaFracao(p) }))}
            contracts={raw.contracts.map((ct) => ({
              id: ct.id,
              label: ct.tenant_name,
              propertyId: ct.property_id,
            }))}
          />
          <EventForm caseId={id} />
        </>
      )}
      <Card title="Contactos, acordos e notas">
        <ol className="divide-y divide-regua">
          {m.events
            .filter((e) => e.case_id === id)
            .sort(
              (a, b) =>
                b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at),
            )
            .map((e) => (
              <li key={e.id} className="py-4">
                <p className="text-xs text-tinta-2">
                  {fmtDate(e.occurred_on)} · {e.kind}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{e.note}</p>
                {e.next_step && (
                  <p className="mt-2 text-sm text-tinta-2">
                    Próximo passo: {e.next_step}
                    {e.due_date ? ` · ${fmtDate(e.due_date)}` : ""}
                  </p>
                )}
              </li>
            ))}
        </ol>
        {!m.events.some((e) => e.case_id === id) && (
          <p className="text-sm text-tinta-2">Ainda não há diligências registadas.</p>
        )}
      </Card>
      {documents?.error && (
        <p role="alert" className="text-sm text-perda">
          Não foi possível abrir os anexos. Atualiza a página para tentar novamente.
        </p>
      )}
      {documents?.data && (
        <Card title="Fotografias e documentos">
          {documents.data.map((d) => (
            <p key={d.path} className="py-2 text-sm">
              {d.signedUrl ? (
                <a href={d.signedUrl} target="_blank" rel="noreferrer" className="text-acao underline">
                  {partirCaminho(d.path || "").nome}
                </a>
              ) : (
                "Documento indisponível"
              )}
            </p>
          ))}
        </Card>
      )}
      <details className="text-sm text-tinta-2">
        <summary className="cursor-pointer text-acao">Histórico de alterações</summary>
        {history.map((h) => (
          <p key={h.id} className="mt-3">
            {fmtDate(h.created_at)} · {h.action === "INSERT" ? "Criado" : "Alterado"} ·{" "}
            {CASE_STATUS_LABEL[h.after_data?.status as keyof typeof CASE_STATUS_LABEL] || "Dados atualizados"}{" "}
            · {String(h.after_data?.responsible || "responsável por atribuir")}
          </p>
        ))}
      </details>
    </div>
  );
}
