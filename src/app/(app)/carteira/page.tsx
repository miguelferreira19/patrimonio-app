// A CARTEIRA (PLANO.md §3 e §5): "como está tudo, e o que aconteceu?".
//
// Uma superfície, um objeto: a faixa. As lentes NÃO mudam a faixa — mudam a coluna da
// direita, a ordem e o filtro. Foi isso que permitiu apagar três vistas (grelha de
// Pagamentos, grelha de Atrasos, tabela de Frações) sem perder nada do que elas diziam.
//
// Server component. O estado todo vive em `searchParams`, por isso é partilhável por
// link e sobrevive a um F5 — que é o que uma tabela filtrada em `useState` nunca fez.

import Link from "next/link";
import { geoOptionsFromBenchmarks } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { getSnapshot } from "@/lib/portfolio";
import { fetchGeoOptions } from "@/lib/portfolio/load";
import { createClient } from "@/lib/supabase/server";
import { PropertyFormButton } from "@/components/forms";
import { Faixa, type LinhaFaixa } from "@/components/faixa/faixa";
import { BarrasDeEstagio } from "@/components/faixa/barras-de-estagio";
import { fraseDeCalibracao } from "@/lib/portfolio/risk";
import { buttonClass } from "@/components/ui";
import { Lede, Money } from "@/components/kit";
import { cn } from "@/lib/cn";
import { fmtEur, fmtPct, monthLabel } from "@/lib/format";
import type { Ativo } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

const LENTES = {
  cobranca: "Cobrança",
  renda: "Renda",
  mercado: "Mercado",
  risco: "Risco",
  vazios: "Vazios",
} as const;
type Lente = keyof typeof LENTES;

const JANELAS = [12, 24] as const;

function isLente(v: string | undefined): v is Lente {
  return v != null && v in LENTES;
}

export default async function CarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{
    lente?: string;
    senhorio?: string;
    meses?: string;
    filtro?: string;
    grupo?: string;
  }>;
}) {
  const sp = await searchParams;
  const janela = JANELAS.includes(Number(sp.meses) as 12 | 24) ? Number(sp.meses) : 24;
  const soAtraso = sp.filtro === "atraso";
  const porSenhorio = sp.grupo === "senhorio";

  const [{ isAdmin }, snap] = await Promise.all([getSession(), getSnapshot()]);

  // V3: para quem nao pode agir, a Carteira e uma so pergunta — quem esta em atraso. As
  // outras quatro lentes sao ferramentas de quem cobra, atualiza rendas e decide vender.
  // A coercao e no servidor, nao so no seletor: escrever `?lente=mercado` a mao nao chega
  // para as ver.
  const lente: Lente = !isAdmin ? "risco" : isLente(sp.lente) ? sp.lente : "cobranca";

  // A lista TODA de territórios do INE, só para quem edita: é no formulário de fração que
  // se escolhe o território de uma fração que ainda não tem nenhum, e o snapshot só traz os
  // benchmarks das que já têm dicofre. Veio da página de Frações, que passou a redirecionar.
  const geoOptions = isAdmin
    ? geoOptionsFromBenchmarks(await fetchGeoOptions(await createClient()))
    : [];

  const senhorios = Array.from(
    new Map(
      snap.ativos.flatMap((a) => a.titulares.map((t) => [t.landlord.id, t.landlord] as const)),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "pt"));

  // O universo é sempre `correntes`: terrenos e vendidos ficam fora de toda a métrica
  // corrente (P0-2c). Quem os quer ver tem a lente Vazios, que os nomeia à parte.
  let universo = snap.correntes;
  if (sp.senhorio) {
    universo = universo.filter((a) => a.titulares.some((t) => t.landlord.id === sp.senhorio));
  }
  if (soAtraso) universo = universo.filter((a) => (a.arrears?.streak ?? 0) > 0);
  if (lente === "vazios") universo = universo.filter((a) => !a.activeContract || a.vazios.length > 0);
  if (lente === "mercado") universo = universo.filter((a) => a.mercado.deviation !== null);

  const linhas = universo
    .map((a) => linhaDe(a, lente, janela))
    .sort(ordemDa(lente));

  const meses = snap.carteira.slice(-janela).map((c) => c.month);
  const calibracao = fraseDeCalibracao(snap.risco, (v) => fmtEur(v));
  const totalDireita = linhas.reduce((acc, l) => acc + (l.valor ?? 0), 0);

  return (
    <div className="space-y-4">
      <Lede
        eyebrow="Carteira"
        title={titulo(lente, linhas.length, totalDireita, snap.arrears.summary.totalDebt)}
        actions={
          isAdmin ? (
            <>
              <Link href="/admin" className={buttonClass({ variant: "outline" })}>
                Importar recibos
              </Link>
              <PropertyFormButton landlords={senhorios} geoOptions={geoOptions} />
            </>
          ) : undefined
        }
      >
        {snap.horizon
          ? `Cada barra é um mês, e a altura é a fração da renda que entrou. À direita da linha tracejada a app ainda não sabe: os recibos vão até ${monthLabel(snap.horizon)}.`
          : "Sem recibos importados: a app não tem base para dizer o que está pago."}
      </Lede>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-regua py-2">
        {isAdmin && (
          <>
            <Segmentado
              opcoes={Object.entries(LENTES).map(([v, label]) => ({ v, label }))}
              ativo={lente}
              href={(v) => hrefCom(sp, { lente: v, filtro: undefined })}
            />
            <span className="h-4 w-px bg-regua" />
          </>
        )}
        <Segmentado
          opcoes={JANELAS.map((n) => ({ v: String(n), label: `${n}m` }))}
          ativo={String(janela)}
          href={(v) => hrefCom(sp, { meses: v })}
        />
        {senhorios.length > 1 && (
          <>
            <span className="h-4 w-px bg-regua" />
            <Segmentado
              opcoes={[
                { v: "", label: "Todos" },
                ...senhorios.map((l) => ({ v: l.id, label: l.name })),
              ]}
              ativo={sp.senhorio ?? ""}
              href={(v) => hrefCom(sp, { senhorio: v || undefined })}
            />
          </>
        )}
        {soAtraso && (
          <Link href={hrefCom(sp, { filtro: undefined })} className="text-xs text-acao hover:underline">
            limpar filtro de atraso
          </Link>
        )}
      </div>

      {lente === "risco" && snap.risco.esperada > 0 && (
        <section className="flex flex-col gap-3 border-b border-regua pb-3 sm:flex-row sm:items-end sm:justify-between">
          <BarrasDeEstagio porEstagio={snap.risco.porEstagio} className="sm:max-w-md sm:flex-1" />
          {calibracao && <p className="max-w-[52ch] text-xs text-tinta-2">{calibracao}</p>}
        </section>
      )}

      {linhas.length === 0 ? (
        <p className="py-8 text-center text-sm text-tinta-2">
          Nenhuma fração nesta lente.{" "}
          <Link href="/carteira" className="text-acao hover:underline">
            Ver a carteira toda
          </Link>
        </p>
      ) : (
        <Faixa
          linhas={porSenhorio ? ordenarPorSenhorio(linhas, universo) : linhas}
          meses={meses}
          horizon={snap.horizon}
          carteira={snap.carteira.slice(-janela)}
          isAdmin={isAdmin}
          pagamentos={snap.pagamentosRecentes}
        />
      )}
    </div>
  );
}

// ---------- Lentes: só a coluna da direita e a ordem mudam ----------

function linhaDe(a: Ativo, lente: Lente, janela: number): LinhaFaixa {
  const c = a.activeContract;
  const arr = a.arrears;
  const base = {
    id: a.property.id,
    nome: a.property.name,
    href: `/fracoes/${a.property.id}`,
    celulas: a.faixa.slice(-janela),
    contract: c,
    estado: (!c ? "vago" : (arr?.streak ?? 0) > 0 ? "atencao" : "arrendado") as LinhaFaixa["estado"],
  };

  switch (lente) {
    case "cobranca":
      return {
        ...base,
        sub: c ? c.tenant_name : "sem contrato",
        valor: arr?.expectedRent ?? c?.rent ?? null,
        nota: arr && arr.debt > 0 ? `${fmtEur(arr.debt)} em falta` : c ? "em dia" : "vago",
        notaTom: arr && arr.debt > 0 ? "perda" : "tinta-2",
      };
    case "renda":
      return {
        ...base,
        sub: [c?.tenant_name, a.property.typology, a.property.area_m2 && `${a.property.area_m2} m²`]
          .filter(Boolean)
          .join(" · "),
        valor: c?.rent ?? null,
        nota: a.mercado.rentPerM2 ? `${a.mercado.rentPerM2.toFixed(2)} €/m²` : "área por preencher",
        notaTom: a.mercado.rentPerM2 ? "tinta-2" : "futuro",
      };
    case "mercado":
      return {
        ...base,
        sub: `${c?.tenant_name ?? "vago"} · mediana ${a.mercado.benchmarkRentM2?.toFixed(2) ?? "?"} €/m²`,
        valor: a.mercado.gapEurMonth ?? 0,
        nota:
          a.mercado.deviation === null
            ? "sem referência"
            : `${fmtPct(Math.abs(a.mercado.deviation), 0)} ${a.mercado.deviation < 0 ? "abaixo" : "acima"}`,
        notaTom: (a.mercado.deviation ?? 0) < 0 ? "atencao" : "tinta-2",
      };
    case "risco": {
      // O valor é a PERDA ESPERADA, não `streak × renda`: essa contava como perdido
      // dinheiro que historicamente entra no import seguinte (Fase 4, risk.ts).
      const risco = a.risco;
      const fiabilidade = risco
        ? `${fmtPct(risco.p.p, 0)} fiável (n=${risco.p.n})`
        : "sem histórico";
      return {
        ...base,
        sub: c
          ? `${c.tenant_name} · ${fiabilidade}${arr?.stale ? " · contrato suspeito" : ""}`
          : "sem contrato",
        valor: risco?.esperada ?? 0,
        nota:
          !arr || arr.streak === 0
            ? risco
              ? `estágio ${risco.estagio}`
              : "em dia"
            : `${arr.streak} ${arr.streak === 1 ? "mês" : "meses"} · estágio ${risco?.estagio ?? 2}`,
        notaTom: !arr || arr.streak === 0 ? "tinta-2" : "perda",
      };
    }
    case "vazios": {
      const aberto = a.vazios.find((v) => v.gapEnd === null);
      const perdido = a.vazios.reduce((acc, v) => acc + v.lostRent, 0);
      return {
        ...base,
        sub: aberto
          ? `vago desde ${monthLabel(aberto.gapStart.slice(0, 7))}`
          : `${a.vazios.length} ${a.vazios.length === 1 ? "vazio" : "vazios"} no histórico`,
        valor: perdido,
        nota: aberto ? `${aberto.days} dias` : "reocupada",
        notaTom: aberto ? "perda" : "tinta-2",
      };
    }
  }
}

function ordemDa(lente: Lente): (a: LinhaFaixa, b: LinhaFaixa) => number {
  // Em todas as lentes de dinheiro-em-risco o maior valor vem primeiro; nas descritivas
  // manda o nome, que é o que se procura com os olhos.
  if (lente === "renda") return (a, b) => a.nome.localeCompare(b.nome, "pt");
  return (a, b) => (b.valor ?? 0) - (a.valor ?? 0) || a.nome.localeCompare(b.nome, "pt");
}

function ordenarPorSenhorio(linhas: LinhaFaixa[], universo: Ativo[]): LinhaFaixa[] {
  const nomePorId = new Map(
    universo.map((a) => [a.property.id, a.titulares.map((t) => t.landlord.name).sort().join(", ")]),
  );
  return linhas.slice().sort((a, b) => {
    const na = nomePorId.get(a.id) ?? "";
    const nb = nomePorId.get(b.id) ?? "";
    return na.localeCompare(nb, "pt") || a.nome.localeCompare(b.nome, "pt");
  });
}

function titulo(lente: Lente, n: number, total: number, divida: number) {
  const fracoes = `${n} ${n === 1 ? "fração" : "frações"}`;
  switch (lente) {
    case "cobranca":
      return divida > 0 ? (
        <>
          {fracoes}, <Money value={total} tom="tinta" /> por mês, <Money value={divida} tom="perda" />{" "}
          por cobrar.
        </>
      ) : (
        <>
          {fracoes}, <Money value={total} tom="tinta" /> por mês, tudo cobrado.
        </>
      );
    case "renda":
      return (
        <>
          {fracoes} arrendadas por <Money value={total} tom="tinta" /> por mês.
        </>
      );
    case "mercado":
      return (
        <>
          {fracoes} com referência do INE: <Money value={total} tom="acao" /> por mês na mesa.
        </>
      );
    case "risco":
      return (
        <>
          {fracoes} em risco, <Money value={total} tom="perda" /> de perda esperada.
        </>
      );
    case "vazios":
      return (
        <>
          {fracoes} com vazios, <Money value={total} tom="perda" /> de renda perdida.
        </>
      );
  }
}

// ---------- Controlos ----------

/** Segmented control feito de links: sem estado de cliente, partilhável e com histórico
 *  do browser a funcionar. Um `useState` aqui só traria um bug de sincronização. */
function Segmentado({
  opcoes,
  ativo,
  href,
}: {
  opcoes: Array<{ v: string; label: string }>;
  ativo: string;
  href: (v: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {opcoes.map((o) => (
        <Link
          key={o.v}
          href={href(o.v)}
          aria-current={o.v === ativo ? "page" : undefined}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs transition-colors",
            o.v === ativo
              ? "bg-acao-tenue font-medium text-acao"
              : "text-tinta-2 hover:bg-elevado hover:text-tinta",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

function hrefCom(
  atual: Record<string, string | undefined>,
  mudanca: Record<string, string | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...atual, ...mudanca })) {
    if (v) p.set(k, v);
  }
  const q = p.toString();
  return q ? `/carteira?${q}` : "/carteira";
}
