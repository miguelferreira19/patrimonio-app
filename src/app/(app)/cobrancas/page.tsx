// COBRANÇAS (PLANO_CLAREZA.md, Fase 1): quem deve, quanto e desde quando.
//
// Era uma tabela mês a mês com 7 estados de pagamento, aberta no mês corrente: a dívida dos
// meses anteriores nem aparecia, e as 42 rendas diziam "por confirmar". Agora responde à
// pergunta da família com os MESMOS números do Hoje: `devedores` (emAtrasoDaCarteira por
// inquilino), `resumoDoSnapshot` (por receber) e as fontes paradas (sem informação).
//
// Visual, não prosa (pedido do utilizador, 13/10): cada devedor é uma tira dos últimos 12
// meses; as frases explicativas saíram. A tabela antiga é o Extrato.
//
// 06/11: as tiras passaram a quadrados de 24 px com o nome do mês por cima, e a falta a
// vermelho cheio com um traço ("não consigo perceber quem é que não paga"). Um inquilino com
// vários contratos mostra o pior estado de cada mês na linha principal e os contratos por baixo.

import Link from "next/link";
import { Iniciais, Money } from "@/components/kit";
import { Meses, MesesCabecalho, MesesLegenda } from "@/components/imoveis/meses";
import { Badge, buttonClass } from "@/components/ui";
import { getSession } from "@/lib/data";
import { mesPorExtenso, monthLabel, nomeProprio } from "@/lib/format";
import { getSnapshotComRaw, type Ativo, type Snapshot } from "@/lib/portfolio";
import { tiraDoInquilino } from "@/lib/portfolio/faltas";
import { getManagement } from "@/lib/portfolio/gestao-load";
import { fontesParadas } from "@/lib/portfolio/insights";
import { devedores, type Devedor } from "@/lib/portfolio/inquilinos";
import { resumoDoSnapshot } from "@/lib/portfolio/mes";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import type { ManagementCase } from "@/lib/gestao";

export const dynamic = "force-dynamic";

/** Meses da tira de cada contrato: um ano. */
const MESES_NA_TIRA = 12;

/** Colunas da linha: avatar, nome, tira de 12 meses, dívida e (só o admin) ações. Abaixo de `md`
 *  a tira desce. A coluna das ações tem largura FIXA: com `auto` cada linha media a sua e o
 *  cabeçalho dos meses, sem botões, ficava desalinhado das tiras. */
const GRELHA = {
  admin: "grid-cols-[2.5rem_minmax(0,1fr)_auto] md:grid-cols-[2.5rem_minmax(0,1fr)_auto_7rem_11rem]",
  leitor: "grid-cols-[2.5rem_minmax(0,1fr)_auto] md:grid-cols-[2.5rem_minmax(0,1fr)_auto_7rem]",
};

export default async function Cobrancas() {
  const [{ snap }, { isAdmin }, gestao] = await Promise.all([getSnapshotComRaw(), getSession(), getManagement()]);
  const lista = devedores(snap);
  const mes = resumoDoSnapshot(snap);
  const total = lista.reduce((a, d) => a + d.divida, 0);
  const nContratos = lista.reduce((a, d) => a + d.contratos.length, 0);
  const ativoDe = new Map(snap.ativos.flatMap((a) => (a.activeContract ? [[a.activeContract.id, a] as const] : [])));
  const diligencia = (contractId: string) =>
    gestao.cases
      .filter((c) => c.contract_id === contractId && c.status !== "concluido")
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
  const mesesDaTira = snap.faixaMeses.slice(-MESES_NA_TIRA);
  // As TRÊS caixas na mesma espécie (AUDITORIA_CLAREZA.md, ponto 8). "Sem informação"
  // mostrava a renda POR MÊS ao lado de duas dívidas acumuladas, com a unidade escondida no
  // detalhe: quem lia comparava 6 845 com 7 162 e concluía que o atraso era o maior problema.
  const paradas = fontesParadas(snap);
  const semInfo = paradas.reduce((a, f) => a + f.acumulado, 0);
  const semInfoContratos = paradas.reduce((a, f) => a + f.contratos, 0);
  const semInfoMeses = Math.max(0, ...paradas.map((f) => f.meses));

  return (
    <div className="space-y-8 md:space-y-10">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-tinta md:text-[30px]">Cobranças</h1>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Caixa
          href="#em-atraso"
          rotulo="Em atraso"
          valor={total}
          tom="perda"
          unidade="acumulado"
          detalhe={`${lista.length} ${lista.length === 1 ? "inquilino" : "inquilinos"} · ${nContratos} ${nContratos === 1 ? "contrato" : "contratos"}`}
        />
        <Caixa
          href="#este-mes"
          rotulo="Por receber"
          valor={mes.porReceber}
          unidade={mesPorExtenso(mes.mes)}
          detalhe={`${mes.porReceberContratos.length} ${mes.porReceberContratos.length === 1 ? "contrato" : "contratos"}`}
        />
        <Caixa
          href="#sem-informacao"
          rotulo="Sem informação"
          valor={semInfo}
          tom="futuro"
          unidade="acumulado"
          detalhe={`${semInfoContratos} contratos · ${semInfoMeses} ${semInfoMeses === 1 ? "mês" : "meses"}`}
        />
      </div>

      <section id="em-atraso" className="scroll-mt-24">
        <Cabecalho titulo="Em atraso" valor={<Money value={total} escala="xl" tom={total > 0 ? "perda" : "tinta"} />}>
          {mesesDaTira.length > 0 && (
            <span className="text-xs text-tinta-3">
              {monthLabel(mesesDaTira[0])} a {monthLabel(mesesDaTira[mesesDaTira.length - 1])}
            </span>
          )}
        </Cabecalho>
        {lista.length === 0 ? (
          <p className="vazio">Ninguém em atraso.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-regua bg-carta">
              <div
                className={`hidden items-end gap-x-3.5 border-b border-regua px-6 pb-2.5 pt-4 md:grid ${isAdmin ? GRELHA.admin : GRELHA.leitor}`}
              >
                <span />
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-tinta-3">Inquilino</span>
                <MesesCabecalho meses={mesesDaTira} tamanho="lg" />
                <span className="text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-tinta-3">Dívida</span>
                {isAdmin && <span />}
              </div>
              <ul className="stagger divide-y divide-regua">
                {lista.map((d) => (
                  <LinhaDevedor key={d.chave} d={d} ativoDe={ativoDe} isAdmin={isAdmin} diligencia={diligencia} />
                ))}
              </ul>
            </div>
            <div className="mt-3">
              <MesesLegenda itens={["pago", "falta", "parcial", "fora"]} />
            </div>
          </>
        )}
      </section>

      <SemInformacao snap={snap} />

      <section id="este-mes" className="scroll-mt-24">
        <Cabecalho titulo={`Por receber · ${mesPorExtenso(mes.mes)}`} valor={<Money value={mes.porReceber} escala="xl" />}>
          <span className="text-xs text-tinta-3">recolhas a 15 e no último dia</span>
        </Cabecalho>
        {mes.porReceberContratos.length === 0 ? (
          <p className="vazio">Tudo recebido.</p>
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

const CAIXA_TOM = {
  tinta: { cartao: "border-regua bg-carta", ponto: "bg-regua-forte", rotulo: "text-tinta-2" },
  perda: { cartao: "border-perda/25 bg-perda-tenue", ponto: "bg-perda", rotulo: "text-perda" },
  futuro: { cartao: "border-regua bg-carta", ponto: "bg-futuro", rotulo: "text-futuro" },
} as const;

function Caixa({
  href,
  rotulo,
  valor,
  detalhe,
  unidade,
  tom = "tinta",
}: {
  href: string;
  rotulo: string;
  valor: number;
  detalhe: string;
  /** A espécie do número, à vista e nunca escondida no detalhe (ponto 8). */
  unidade: string;
  tom?: keyof typeof CAIXA_TOM;
}) {
  const tomEfetivo = valor > 0 ? tom : "tinta";
  const t = CAIXA_TOM[tomEfetivo];
  return (
    <a href={href} className={`cartao-link min-w-0 rounded-2xl border p-3 sm:p-5 ${t.cartao}`}>
      <p className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] ${t.rotulo}`}>
        <i aria-hidden="true" className={`hidden size-2 shrink-0 rounded-full sm:block ${t.ponto}`} />
        <span className="truncate">{rotulo}</span>
      </p>
      <div className="mt-1.5 sm:mt-2">
        <Money value={valor} escala="xl" tom={tomEfetivo} className="sm:text-[32px] sm:tracking-[-0.03em]" />
      </div>
      <p className="mt-1 truncate text-xs font-medium text-tinta-2">{unidade}</p>
      <p className="truncate text-xs text-tinta-2">{detalhe}</p>
    </a>
  );
}

function LinhaDevedor({
  d,
  ativoDe,
  isAdmin,
  diligencia,
}: {
  d: Devedor;
  ativoDe: Map<string, Ativo>;
  isAdmin: boolean;
  diligencia: (contractId: string) => ManagementCase | undefined;
}) {
  const estados = (id: string) => (ativoDe.get(id)?.faixa ?? []).slice(-MESES_NA_TIRA).map((m) => m.status);
  const tira = tiraDoInquilino(d.contratos.map((c) => estados(c.contract.id)));
  const piorMeses = Math.max(...d.contratos.map((c) => c.meses));
  const unico = d.contratos.length === 1 ? d.contratos[0] : null;
  const casoUnico = unico ? diligencia(unico.contract.id) : undefined;

  return (
    <li className="px-4 py-4 md:px-6">
      <div className={`grid items-center gap-x-3.5 gap-y-3 ${isAdmin ? GRELHA.admin : GRELHA.leitor}`}>
        <Iniciais nome={nomeProprio(d.nome)} />
        <div className="min-w-0">
          <Link
            href={`/inquilinos/${encodeURIComponent(d.chave)}`}
            className="line-clamp-2 break-words text-[15.5px] font-semibold leading-snug text-tinta hover:text-acao"
          >
            {nomeProprio(d.nome)}
          </Link>
          <p className="truncate text-[13px] text-tinta-2">
            {unico ? (
              <Link href={`/fracoes/${unico.property.id}`} className="hover:text-acao">
                {nomeDaFracao(unico.property)}
              </Link>
            ) : (
              `${d.contratos.length} contratos`
            )}
            {` · desde ${monthLabel(d.desde)}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 md:order-1">
          <Money value={d.divida} tom="perda" className="text-lg font-semibold" />
          <Badge tone={piorMeses >= 3 ? "perda" : "atencao"}>
            {piorMeses} {piorMeses === 1 ? "mês" : "meses"}
          </Badge>
        </div>
        <div className="col-span-3 md:col-span-1">
          <Meses meses={tira} tamanho="md" className="md:hidden" />
          <Meses meses={tira} tamanho="lg" className="hidden md:flex" />
        </div>
        {isAdmin && unico && <Acoes contractId={unico.contract.id} className="col-span-3 md:order-2 md:col-span-1" />}
      </div>
      {casoUnico && (
        <div className="mt-2 md:pl-[54px]">
          <Badge tone="acao">{casoUnico.next_step || casoUnico.title}</Badge>
        </div>
      )}
      {!unico && (
        <ul className="mt-3 space-y-2.5 border-t border-regua pt-3 md:pl-[54px]">
          {d.contratos.map((c) => {
            const caso = diligencia(c.contract.id);
            return (
              <li key={c.contract.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <Link href={`/fracoes/${c.property.id}`} className="min-w-0 flex-1 basis-40 truncate text-tinta-2 hover:text-acao">
                  {nomeDaFracao(c.property)}
                </Link>
                <Badge tone={c.meses >= 3 ? "perda" : "atencao"}>
                  {c.meses} {c.meses === 1 ? "mês" : "meses"}
                </Badge>
                <Meses meses={estados(c.contract.id)} tamanho="md" />
                <Money value={c.divida} escala="sm" tom="tinta-2" />
                {caso && <Badge tone="acao">{caso.next_step || caso.title}</Badge>}
                {isAdmin && <Acoes contractId={c.contract.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function Acoes({ contractId, className }: { contractId: string; className?: string }) {
  return (
    <span className={`flex flex-wrap justify-end gap-1.5 ${className ?? ""}`}>
      <Link href={`/cobrancas/${contractId}`} className={buttonClass({ variant: "outline", size: "sm" })}>
        Contacto
      </Link>
      <a href={`/api/minuta/interpelacao/${contractId}`} className={buttonClass({ variant: "primary", size: "sm" })}>
        Carta
      </a>
    </span>
  );
}

/** As fontes de recibos paradas (a herança do avô): três números, e os contratos em caixas. */
function SemInformacao({ snap }: { snap: Snapshot }) {
  const paradas = fontesParadas(snap);
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
            {/* O acumulado é o número grande, como nas caixas do topo; a renda por mês fica
                como facto rotulado, ao lado dos meses que a produziram (ponto 8). */}
            <Cabecalho titulo="Sem informação" valor={<Money value={f.acumulado} escala="xl" tom="futuro" />}>
              <Badge tone="futuro">Recibos de {nomeProprio(f.landlord.name)} suspensos</Badge>
            </Cabecalho>
            <div className="tecido-futuro rounded-2xl border border-regua bg-futuro-tenue p-3 sm:p-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Facto rotulo="Contratos" valor={String(linhas.length)} />
                <Facto rotulo="Por mês" valor={<Money value={porMes} escala="xl" tom="futuro" />} />
                <Facto rotulo="Meses sem recibo" valor={String(f.meses)} />
                <Facto rotulo="Último recibo" valor={monthLabel(f.horizonte)} />
              </dl>
              <details className="mt-3">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-acao">
                  Ver os {linhas.length} contratos
                </summary>
                <GrelhaDeContratos linhas={linhas} ativoDe={ativoDe} />
              </details>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Facto({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-regua bg-carta px-4 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">{rotulo}</dt>
      <dd className="mt-1.5 text-xl font-semibold tabular-nums text-tinta">{valor}</dd>
    </div>
  );
}

function GrelhaDeContratos({ linhas, ativoDe }: { linhas: Array<{ id: string; valor: number }>; ativoDe: Map<string, Ativo> }) {
  return (
    <ul className="stagger grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {linhas.map(({ id, valor }) => {
        const a = ativoDe.get(id);
        if (!a) return null;
        return (
          <li key={id}>
            <Link
              href={`/fracoes/${a.property.id}`}
              className="cartao-link block h-full rounded-xl border border-regua bg-carta px-3 py-2.5"
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
