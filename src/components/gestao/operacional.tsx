// O EXTRATO mês a mês (V5) e os filtros de período/âmbito partilhados.
//
// Desde o plano de clareza (Fase 1) esta tabela já não é a página Cobranças: a Cobranças
// responde "quem deve"; isto responde "o que se passou com o contrato X no mês Y", para o
// administrador. Os estados são os MESMOS de todo o lado (monthcell.ts, ESTADO_MES_LABEL).

import Link from "next/link";
import { Badge, Button, Field, Input, Select, type BadgeTone } from "@/components/ui";
import { Money } from "@/components/kit/money";
import { AMBITO_LABEL } from "@/lib/gestao";
import { ESTADO_MES_LABEL, type EstadoMes } from "@/lib/monthcell";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import { fmtDate, monthLabel, nomeProprio } from "@/lib/format";
import type { OperationalQuery, operationalData } from "@/lib/portfolio/operacional";
import type { Landlord } from "@/lib/types";

const TOM_DO_ESTADO: Record<EstadoMes, BadgeTone> = {
  pago: "confirmado",
  atraso: "atencao",
  por_receber: "neutro",
  sem_info: "futuro",
  fora: "neutro",
};

export function State({ state }: { state: EstadoMes }) {
  return <Badge tone={TOM_DO_ESTADO[state]}>{ESTADO_MES_LABEL[state]}</Badge>;
}

export function ScopeFilters({
  q,
  landlords,
  action,
  period = true,
  hidden = {},
  search = true,
  ambito = true,
  extrato = false,
}: {
  q: OperationalQuery;
  landlords: Landlord[];
  action: string;
  period?: boolean;
  hidden?: Record<string, string>;
  search?: boolean;
  /** Âmbito e proprietário: só no Extrato e na Projeção (admin). A família vê por inteiro. */
  ambito?: boolean;
  /** Estado e ordenação dos meses: só fazem sentido no Extrato. */
  extrato?: boolean;
}) {
  const esteMes = new Date().toISOString().slice(0, 7);
  return (
    <details open={q.ambito === "proprietario" && !q.senhorio} className="rounded-2xl border border-regua bg-carta p-4">
      <summary className="min-h-8 cursor-pointer text-sm font-semibold text-acao">
        Filtrar
      </summary>
      <form action={action} className="mt-4">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {search && (
            <Field label="Pesquisar imóvel ou inquilino">
              <Input name="q" defaultValue={q.q} type="search" />
            </Field>
          )}
          {period && (
            <>
              <Field label="Desde o mês">
                <Input name="de" type="month" defaultValue={q.de ?? esteMes} required />
              </Field>
              <Field label="Até ao mês">
                <Input name="ate" type="month" defaultValue={q.ate ?? q.de ?? esteMes} required />
              </Field>
            </>
          )}
          {ambito && (<>
          <Field label="Âmbito dos valores">
            <Select name="ambito" defaultValue={q.ambito ?? "inteiro"}>
              {Object.entries(AMBITO_LABEL).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Proprietário">
            <Select name="senhorio" defaultValue={q.senhorio ?? ""}>
              <option value="">Todos</option>
              {landlords.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </Field>
          </>)}
          {period && extrato && (
            <>
              <Field label="Estado">
                <Select name="estado" defaultValue={q.estado ?? ""}>
                  <option value="">Todos</option>
                  {Object.entries(ESTADO_MES_LABEL).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Ordenar por">
                <Select name="ordem" defaultValue={q.ordem ?? "imovel"}>
                  <option value="imovel">Imóvel e mês</option>
                  <option value="inquilino">Inquilino</option>
                  <option value="saldo">Valor por pagar</option>
                </Select>
              </Field>
            </>
          )}
          <Button type="submit">Aplicar filtros</Button>
        </div>
      </form>
    </details>
  );
}

const RECIBO: Record<"emitido" | "por_emitir" | "por_importar", string> = {
  emitido: "Recibo emitido",
  por_emitir: "Recibo por emitir",
  por_importar: "Recibos por importar",
};

export function OperationalTable({
  data,
  q,
  back = "/cobrancas/extrato",
}: {
  data: Awaited<ReturnType<typeof operationalData>>;
  q: OperationalQuery;
  back?: string;
}) {
  const filtros = Object.entries(q).filter((e): e is [string, string] => typeof e[1] === "string");
  const contexto = `${back}?${new URLSearchParams(filtros)}`;
  const mesHref = (contractId: string, month: string) =>
    `/cobrancas/${contractId}?mes=${month.slice(0, 7)}&voltar=${encodeURIComponent(contexto)}`;
  const colunas = ["Imóvel / mês", "Inquilino", "Renda (ilíquida)", "Recebido (líquido)", "Por pagar", "Estado", "Próxima ação"];

  return (
    <div>
      <p className="mb-2 text-xs text-tinta-2 sm:hidden">Desliza a tabela para ver todas as colunas.</p>
      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-regua bg-carta">
        <table className="w-full min-w-[960px] text-left text-sm">
          <caption className="sr-only">Extrato por imóvel, contrato e mês. {AMBITO_LABEL[data.scope]}</caption>
          <thead className="sticky top-0 z-10 bg-vellum text-xs text-tinta-2">
            <tr>
              {colunas.map((s, i) => (
                <th key={s} scope="col" className={i === 0 ? "sticky left-0 z-20 bg-vellum px-4 py-3 font-medium" : "px-4 py-3 font-medium"}>
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-regua">
            {data.rows.map(({ contract, property, share, statement: s, next }) => {
              const parte = (v: number) => (share === null ? null : v * share);
              return (
                <tr key={`${contract.id}/${s.month}`} className="align-top hover:bg-vellum/50">
                  <th scope="row" className="sticky left-0 z-10 bg-carta px-4 py-4 font-medium">
                    <Link href={mesHref(contract.id, s.month)} className="text-acao underline-offset-4 hover:underline">
                      {nomeDaFracao(property)}
                    </Link>
                    <p className="mt-1 text-xs font-normal text-tinta-2">
                      {monthLabel(s.month)}
                      {contract.status === "cessado" ? " · contrato cessado" : ""}
                    </p>
                  </th>
                  <td className="px-4 py-4">{nomeProprio(contract.tenant_name)}</td>
                  <td className="px-4 py-4"><Money value={parte(s.contracted)} decimals={2} /></td>
                  <td className="px-4 py-4">
                    <Money value={parte(s.recorded)} decimals={2} />
                    {s.confirmed > 0 && <p className="mt-1 text-xs text-tinta-2">registado à mão</p>}
                  </td>
                  <td className="px-4 py-4">
                    <Money value={parte(s.pending)} decimals={2} tom={s.status === "atraso" ? "atencao" : "tinta-2"} />
                  </td>
                  <td className="space-y-2 px-4 py-4">
                    <State state={s.status} />
                    <p className="text-xs text-tinta-2">{RECIBO[s.receiptState]}</p>
                    {share === null && <p className="text-xs text-tinta-2">Quota desconhecida</p>}
                  </td>
                  <td className="px-4 py-4">
                    <Link href={next ? `/gestao/${next.id}` : mesHref(contract.id, s.month)} className="text-acao hover:underline">
                      {next?.next_step || next?.title || "Abrir o mês"}
                    </Link>
                    {next?.due_date && <p className="mt-1 text-xs text-tinta-2">Até {fmtDate(next.due_date)}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data.rows.length && (
          <p className="p-8 text-sm text-tinta-2">Nenhum registo corresponde aos filtros. Ajusta o período ou o estado.</p>
        )}
      </div>
    </div>
  );
}

export function OwnerSelection({
  title,
  q,
  landlords,
  action,
  hidden,
}: {
  title: string;
  q: OperationalQuery;
  landlords: Landlord[];
  action: string;
  hidden?: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-tinta-2">
        Seleciona um proprietário para consultar a sua parte. Os totais ficam por calcular até essa escolha.
      </p>
      <ScopeFilters q={q} landlords={landlords} action={action} hidden={hidden} />
    </div>
  );
}
