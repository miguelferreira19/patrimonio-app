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
import { CelulaLegenda } from "@/components/faixa/celula";
import { BarrasDeEstagio } from "@/components/faixa/barras-de-estagio";
import { fraseDeCalibracao } from "@/lib/portfolio/risk";
import { buttonClass } from "@/components/ui";
import { Figure, Lede, Money } from "@/components/kit";
import { cn } from "@/lib/cn";
import { fmtEur, fmtPct, monthLabel } from "@/lib/format";
import type { Ativo } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

const LENTES = {
  // Três lentes, e não cinco (2026-07-31, a pedido do utilizador). "Renda" e "Mercado"
  // saíram: a renda do contrato já é o número da Cobrança, e o €/m² contra a mediana do
  // INE tem uma superfície inteira só para ele desde que o Mercado subiu a destino. Cinco
  // chips não cabiam no telemóvel e as duas que sobravam não mudavam nenhuma decisão.
  cobranca: "Cobrança",
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

  const linhas = universo
    .map((a) => linhaDe(a, lente, janela))
    .sort(ordemDa(lente));

  const meses = snap.carteira.slice(-janela).map((c) => c.month);
  const calibracao = fraseDeCalibracao(snap.risco, (v) => fmtEur(v));
  const totalDireita = linhas.reduce((acc, l) => acc + (l.valor ?? 0), 0);

  const heroi = heroiDa(lente, linhas.length, totalDireita, snap.arrears.summary.totalDebt);
  const arrendadas = universo.filter((a) => a.activeContract).length;

  return (
    <div className="space-y-8">
      <Lede
        eyebrow={`Carteira · ${LENTES[lente]}`}
        title={<Money value={heroi.valor} escala="hero" tom={heroi.tom} />}
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
        {heroi.legenda}
      </Lede>

      {/* Os números que a frase-título carregava, agora em voz baixa: confere-se aqui em
          vez de os ler dentro de uma manchete. */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-regua py-3.5 sm:grid-cols-4">
        <Facto rotulo="Frações" valor={<Figure value={String(universo.length)} escala="lg" />} />
        <Facto
          rotulo="Arrendadas"
          valor={<Figure value={`${arrendadas} de ${universo.length}`} escala="lg" />}
        />
        <Facto
          rotulo="Renda contratada"
          valor={<Money value={snap.totais.rendaContratada} escala="lg" />}
          nota="por mês, contratos ativos"
        />
        <Facto
          rotulo="Recibos conhecidos até"
          valor={
            <span className="text-[17px] font-medium text-tinta">
              {snap.horizon ? monthLabel(snap.horizon) : "nenhum"}
            </span>
          }
          nota={snap.horizon ? "à direita disto, a app não sabe" : "sem base para dizer o que está pago"}
        />
      </dl>

      <div className="-mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-regua pb-2.5">
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

      {/* R4: a explicação do gráfico é a LEGENDA, não um parágrafo. A altura da barra é a
          fração da renda que entrou, e a hachura diz o que a app não sabe — isso lê-se aqui,
          ao lado do objeto, e não numa frase no topo da página. */}
      {linhas.length > 0 && (
        <CelulaLegenda estados={["pago", "parcial", "falta", "fora", "futuro"]} />
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
    estado: (!c ? "vago" : (arr?.streak ?? 0) > 0 ? "atencao" : "arrendado") as LinhaFaixa["estado"],
  };

  switch (lente) {
    case "cobranca": {
      // QUANTOS meses, e não só quantos euros: "1.950 € em falta" não diz se são três
      // rendas seguidas ou um ano de mensalidades curtas, e era o que faltava para
      // perceber a linha sem contar as células vermelhas uma a uma.
      const meses = arr?.streak ?? 0;
      return {
        ...base,
        sub: c ? c.tenant_name : "sem contrato",
        valor: arr?.expectedRent ?? c?.rent ?? null,
        nota:
          arr && arr.debt > 0
            ? `${meses} ${meses === 1 ? "mês" : "meses"} · ${fmtEur(arr.debt)} em falta`
            : c
              ? "em dia"
              : "vago",
        notaTom: arr && arr.debt > 0 ? "perda" : "tinta-2",
      };
    }
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
  // Maior valor primeiro em todas: as três lentes que sobraram são de dinheiro em risco.
  void lente;
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

/** O NÚMERO HERÓI de cada lente, e a frase curta que o nomeia (R1: um número, no máximo
 *  oito palavras à volta — nunca uma frase inteira como título).
 *
 *  Antes daqui saía "26 frações, 8.305 € por mês, 1.240 € por cobrar." como TÍTULO: três
 *  números em concorrência dentro de uma frase, e nenhum deles a ler-se primeiro. Cada
 *  lente tem uma pergunta só, e o herói é a resposta a essa pergunta; os outros números
 *  descem para a tira de factos, que é onde se conferem sem disputar a atenção. */
function heroiDa(
  lente: Lente,
  n: number,
  total: number,
  divida: number,
): { valor: number; tom: "tinta" | "acao" | "perda"; legenda: string } {
  const fracoes = `${n} ${n === 1 ? "fração" : "frações"}`;
  switch (lente) {
    case "cobranca":
      return divida > 0
        ? { valor: divida, tom: "perda", legenda: `por cobrar, em ${fracoes}.` }
        : { valor: total, tom: "tinta", legenda: `por mês em ${fracoes}, tudo cobrado.` };
    case "risco":
      return { valor: total, tom: "perda", legenda: `de perda esperada, em ${fracoes}.` };
    case "vazios":
      return { valor: total, tom: "perda", legenda: `de renda perdida, em ${fracoes}.` };
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

/** Um facto da tira: rótulo pequeno, número a peso, nota opcional. Mesmo desenho da
 *  `/mercado` e do `Retrato` — três variações do mesmo objeto seria o começo de um
 *  dialecto por página. */
function Facto({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: React.ReactNode;
  nota?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">{rotulo}</dt>
      <dd className="mt-1">{valor}</dd>
      {nota && <dd className="mt-0.5 text-[11px] leading-snug text-tinta-3">{nota}</dd>}
    </div>
  );
}
