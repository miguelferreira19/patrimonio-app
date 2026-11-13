import { AFazer } from "@/components/inicio/a-fazer";
import { QuemDeve, ResumoInicio, SemInformacao } from "@/components/inicio/resumo";
import { prazosDoInicio, tarefasDoInicio } from "@/components/inicio/tarefas";
import { Badge } from "@/components/ui";
import { getSession } from "@/lib/data";
import { mesPorExtenso } from "@/lib/format";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { diarioDoInquilino } from "@/lib/portfolio/diario";
import { carregarFontesDoDiario } from "@/lib/portfolio/diario-load";
import { estadoDaRecolha } from "@/lib/portfolio/recolha";
import { carregarCorridasDaRecolha } from "@/lib/portfolio/recolha-load";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const { isAdmin, supabase } = await getSession();
  const [{ snap, raw }, corridas] = await Promise.all([
    getSnapshotComRaw(), carregarCorridasDaRecolha(supabase),
  ]);
  const ids = snap.correntes.flatMap((a) => a.activeContract ? [a.activeContract.id] : []);
  const diario = diarioDoInquilino(ids, await carregarFontesDoDiario(supabase, ids));
  const recolha = estadoDaRecolha(corridas, snap.hoje);
  const tarefas = tarefasDoInicio(snap, diario, prazosDoInicio(snap, raw), isAdmin);
  const mes = mesPorExtenso(snap.hoje);
  return <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5 tabular-nums">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="font-display text-2xl font-bold text-tinta">{mes.charAt(0).toUpperCase() + mes.slice(1)}</h1>
      <Badge tone={recolha.tom === "perda" ? "perda" : "confirmado"}>{recolha.texto}</Badge>
    </header>
    {ids.length === 0 ? <div className="vazio">Ainda não há rendas</div> : <>
      <ResumoInicio snap={snap} />
      <QuemDeve snap={snap} />
      <SemInformacao snap={snap} />
      <AFazer tarefas={tarefas} hoje={snap.hoje} />
    </>}
  </div>;
}