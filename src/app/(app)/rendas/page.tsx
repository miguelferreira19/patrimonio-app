import Link from "next/link";
import { Bloco, Lede, Money, Pilulas } from "@/components/kit";
import { selecionarRendas } from "@/components/rendas/filtros";
import { LinhaDaRenda } from "@/components/rendas/linha";
import { PesquisaDeRendas } from "@/components/rendas/pesquisa";
import { buttonClass } from "@/components/ui";
import { getSession } from "@/lib/data";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { diarioDoInquilino } from "@/lib/portfolio/diario";
import { carregarFontesDoDiario } from "@/lib/portfolio/diario-load";
import { emAtrasoDaCarteira } from "@/lib/portfolio/insights";
import { linhasDeRendas } from "@/lib/portfolio/rendas";

export const dynamic = "force-dynamic";
type Parametros = { estado?: string; registar?: string };

export default async function Rendas({ searchParams }: { searchParams: Promise<Parametros> }) {
  const [{ snap }, { isAdmin, isGestor, supabase }, params] = await Promise.all([
    getSnapshotComRaw(), getSession(), searchParams,
  ]);
  const ids = snap.correntes.flatMap((a) => a.activeContract ? [a.activeContract.id] : []);
  const diario = diarioDoInquilino(ids, await carregarFontesDoDiario(supabase, ids));
  const registar = isGestor && params.registar === "1";
  const lista = selecionarRendas(linhasDeRendas(snap, diario), params.estado, registar);
  const total = emAtrasoDaCarteira(snap).reduce((soma, linha) => soma + linha.debt, 0);
  return <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5 tabular-nums">
    <Lede title="Rendas" />
    {registar && <Bloco tom="futuro" rotulo="Escolhe o inquilino" />}
    {total > 0 && <Bloco tom="perda" rotulo="Em atraso"
      valor={<Money value={total} escala="xl" className="text-inherit" />} />}
    <PesquisaDeRendas linhas={lista.linhas.map((linha) => ({ chave: linha.chave, nome: linha.nome,
      conteudo: <LinhaDaRenda linha={linha} registar={registar} vigiar={lista.ativo === "a_vigiar"} />,
    }))} filtros={<Pilulas ativo={lista.ativo} itens={lista.pilulas} />}
      vazio={ids.length === 0 ? "Ainda não há rendas" : lista.ativo === "em_atraso" ? "Tudo em dia" : "Nenhum inquilino neste estado"} />
    {isAdmin && <Link href="/rendas/extrato" className={buttonClass({ variant: "outline" })}>
      Extrato mês a mês
    </Link>}
  </div>;
}