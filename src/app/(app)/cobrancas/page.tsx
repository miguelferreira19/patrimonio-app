// COBRANÇAS (PLANO_CLAREZA.md, Fase 1): quem deve, quanto e desde quando.
//
// Era uma tabela mês a mês com 7 estados de pagamento, aberta no mês corrente: a dívida dos
// meses anteriores nem aparecia, e as 42 rendas diziam "por confirmar". Agora responde à
// pergunta da família com os MESMOS números do Hoje: `devedores` (emAtrasoDaCarteira por
// inquilino), `resumoDoSnapshot` (por receber) e as fontes paradas (sem informação).
//
// Visual, não prosa (pedido do utilizador, 13/10): cada devedor é uma barra do valor e uma
// tira dos últimos 12 meses; as frases explicativas saíram. A tabela antiga é o Extrato.

import Link from "next/link";
import { Money } from "@/components/kit";
import { Meses, MesesLegenda } from "@/components/imoveis/meses";
import { Badge, buttonClass } from "@/components/ui";
import { getSession } from "@/lib/data";
import { mesPorExtenso, monthLabel, nomeProprio } from "@/lib/format";
import { getSnapshotComRaw, type Ativo, type Snapshot } from "@/lib/portfolio";
import { getManagement } from "@/lib/portfolio/gestao-load";
import { devedores, type Devedor } from "@/lib/portfolio/inquilinos";
import { resumoDoSnapshot } from "@/lib/portfolio/mes";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import type { ManagementCase } from "@/lib/gestao";

export const dynamic = "force-dynamic";

/** Meses da tira de cada contrato: um ano. */
const MESES_NA_TIRA = 12;

export default async function Cobrancas() {
  const [{ snap }, { isAdmin }, gestao] = await Promise.all([getSnapshotComRaw(), getSession(), getManagement()]);
  const lista = devedores(snap);
  const mes = resumoDoSnapshot(snap);
  const total = lista.reduce((a, d) => a + d.divida, 0);
  const maior = Math.max(1, ...lista.map((d) => d.divida));
  const nContratos = lista.reduce((a, d) => a + d.contratos.length, 0);
  const ativoDe = new Map(snap.ativos.flatMap((a) => (a.activeContract ? [[a.activeContract.id, a] as const] : [])));
  const diligencia = (contractId: string) =>
    gestao.cases
      .filter((c) => c.contract_id === contractId && c.status !== "concluido")
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
  const tira = snap.faixaMeses.slice(-MESES_NA_TIRA);

  return (
    <div className="space-y-8 md:space-y-10">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-tinta md:text-[30px]">Cobranças</h1>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Caixa href="#em-atraso" rotulo="Em atraso" valor={total} tom="atencao" detalhe={`${nContratos} ${nContratos === 1 ? "contrato" : "contratos"}`} />
        <Caixa
          href="#este-mes"
          rotulo="Por receber"
          valor={mes.porReceber}
          detalhe={`${mes.porReceberContratos.length} · ${mesPorExtenso(mes.mes)}`}
        />
        <Caixa
          href="#sem-informacao"
          rotulo="Sem informação"
          valor={mes.porSaber.valor}
          tom="futuro"
          detalhe={`${mes.porSaber.contratos} contratos · /mês`}
        />
      </div>

      <section id="em-atraso" className="scroll-mt-24">
        <Cabecalho titulo="Em atraso" valor={<Money value={total} escala="lg" tom={total > 0 ? "atencao" : "tinta"} />}>
          {tira.length > 0 && (
            <span className="text-xs text-tinta-3">
              {monthLabel(tira[0])} a {monthLabel(tira[tira.length - 1])}
            </span>
          )}
        </Cabecalho>
        {lista.length === 0 ? (
          <p className="rounded-2xl border border-regua bg-carta px-5 py-6 text-sm text-tinta-2">Ninguém em atraso.</p>
        ) : (
          <>
            <ul className="divide-y divide-regua overflow-hidden rounded-2xl border border-regua bg-carta">
              {lista.map((d) => (
                <LinhaDevedor key={d.chave} d={d} maior={maior} ativoDe={ativoDe} isAdmin={isAdmin} diligencia={diligencia} />
              ))}
            </ul>
            <div className="mt-3">
              <MesesLegenda />
            </div>
          </>
        )}
      </section>

      <SemInformacao snap={snap} />

      <section id="este-mes" className="scroll-mt-24">
        <Cabecalho titulo={`Por receber · ${mesPorExtenso(mes.mes)}`} valor={<Money value={mes.porReceber} escala="lg" />}>
          <span className="text-xs text-tinta-3">recolhas a 15 e no último dia</span>
        </Cabecalho>
        {mes.porReceberContratos.length === 0 ? (
          <p className="rounded-2xl border border-regua bg-carta px-5 py-6 text-sm text-tinta-2">Tudo recebido.</p>
        ) : (
          <GrelhaDeContratos linhas={mes.porReceberContratos} ativoDe={ativoDe} />
        )}
      </section>

      {isAdmin && (
        <Link href="/cobrancas/extrato" className={buttonClass({ variant: "outline" })}>
          Extrato mês a mês
        </Link>
      )}
    </div>
  );
}

function Cabecalho({ titulo, valor, children }: { titulo: string; valor: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-tinta">{titulo}</h2>
        {children}
      </div>
      {valor}
    </header>
  );
}

function Caixa({
  href,
  rotulo,
  valor,
  detalhe,
  tom = "tinta",
}: {
  href: string;
  rotulo: string;
  valor: number;
  detalhe: string;
  tom?: "tinta" | "atencao" | "futuro";
}) {
  return (
    <a href={href} className="min-w-0 rounded-2xl border border-regua bg-carta p-3 transition-colors duration-150 hover:bg-vellum sm:p-5">
      <p className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">{rotulo}</p>
      <div className="mt-1.5 sm:mt-2">
        <Money value={valor} escala="xl" tom={valor > 0 ? tom : "tinta"} />
      </div>
      <p className="mt-1 truncate text-xs text-tinta-2">{detalhe}</p>
    </a>
  );
}

function LinhaDevedor({
  d,
  maior,
  ativoDe,
  isAdmin,
  diligencia,
}: {
  d: Devedor;
  maior: number;
  ativoDe: Map<string, Ativo>;
  isAdmin: boolean;
  diligencia: (contractId: string) => ManagementCase | undefined;
}) {
  return (
    <li className="px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Link href={`/inquilinos/${encodeURIComponent(d.chave)}`} className="min-w-0 truncate text-[15px] font-semibold text-tinta hover:text-acao">
          {nomeProprio(d.nome)}
        </Link>
        <Money value={d.divida} escala="lg" tom="atencao" />
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-vellum" aria-hidden="true">
        <div className="h-full rounded-full bg-atencao" style={{ width: `${(d.divida / maior) * 100}%` }} />
      </div>
      <ul className="mt-3 space-y-2.5">
        {d.contratos.map((c) => {
          const faixa = ativoDe.get(c.contract.id)?.faixa.slice(-MESES_NA_TIRA) ?? [];
          const caso = diligencia(c.contract.id);
          return (
            <li key={c.contract.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <Link href={`/fracoes/${c.property.id}`} className="min-w-0 flex-1 basis-40 truncate text-tinta-2 hover:text-acao">
                {nomeDaFracao(c.property)}
              </Link>
              <Badge tone={c.meses >= 3 ? "perda" : "atencao"}>
                {c.meses} {c.meses === 1 ? "mês" : "meses"}
              </Badge>
              {faixa.length > 0 && <Meses meses={faixa.map((m) => m.status)} />}
              {d.contratos.length > 1 && <Money value={c.divida} escala="sm" tom="tinta-2" />}
              {caso && <Badge tone="acao">{caso.next_step || caso.title}</Badge>}
              {isAdmin && (
                <span className="flex gap-1">
                  <Link href={`/cobrancas/${c.contract.id}`} className={buttonClass({ variant: "ghost", size: "sm" })}>
                    Contacto
                  </Link>
                  <a href={`/api/minuta/interpelacao/${c.contract.id}`} className={buttonClass({ variant: "ghost", size: "sm" })}>
                    Carta
                  </a>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/** As fontes de recibos paradas (a herança do avô): três números, e os contratos em caixas. */
function SemInformacao({ snap }: { snap: Snapshot }) {
  const paradas = snap.fontes.filter((f) => f.parada && f.contratos > 0);
  if (paradas.length === 0) return null;
  const ativoDe = new Map(snap.correntes.flatMap((a) => (a.activeContract ? [[a.activeContract.id, a] as const] : [])));
  return (
    <section id="sem-informacao" className="scroll-mt-24 space-y-4">
      {paradas.map((f) => {
        const linhas = Array.from(ativoDe.values()).flatMap((a) =>
          snap.fonteDoContrato[a.activeContract!.id] === f.landlord.id
            ? [{ id: a.activeContract!.id, valor: snap.expectedByContract[a.activeContract!.id] ?? a.activeContract!.rent }]
            : [],
        );
        const porMes = linhas.reduce((n, l) => n + l.valor, 0);
        return (
          <div key={f.landlord.id}>
            <Cabecalho titulo="Sem informação" valor={<Money value={porMes} escala="lg" tom="futuro" />}>
              <Badge tone="futuro">Recibos de {nomeProprio(f.landlord.name)} suspensos</Badge>
            </Cabecalho>
            <dl className="grid grid-cols-3 gap-3">
              <Facto rotulo="Contratos" valor={String(linhas.length)} />
              <Facto rotulo="Por mês" valor={<Money value={porMes} escala="xl" tom="futuro" />} />
              <Facto rotulo="Último recibo" valor={monthLabel(f.horizonte)} />
            </dl>
            <details className="mt-3">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-acao">
                Ver os {linhas.length} contratos
              </summary>
              <GrelhaDeContratos linhas={linhas} ativoDe={ativoDe} />
            </details>
          </div>
        );
      })}
    </section>
  );
}

function Facto({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-regua bg-carta px-4 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">{rotulo}</dt>
      <dd className="mt-1.5 text-xl font-semibold tabular-nums text-tinta">{valor}</dd>
    </div>
  );
}

function GrelhaDeContratos({ linhas, ativoDe }: { linhas: Array<{ id: string; valor: number }>; ativoDe: Map<string, Ativo> }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {linhas.map(({ id, valor }) => {
        const a = ativoDe.get(id);
        if (!a) return null;
        return (
          <li key={id}>
            <Link
              href={`/fracoes/${a.property.id}`}
              className="block h-full rounded-xl border border-regua bg-carta px-3 py-2.5 transition-colors duration-150 hover:bg-vellum"
            >
              <p className="truncate text-[13px] font-medium text-tinta">{nomeDaFracao(a.property)}</p>
              <Money value={valor} escala="md" tom="tinta-2" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
