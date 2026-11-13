import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import { Linha, Money, Seccao, Tira } from "@/components/kit";
import { CabecalhoInquilino } from "@/components/inquilino/cabecalho";
import { DiarioInquilino } from "@/components/inquilino/diario";
import { EscadaInquilino } from "@/components/inquilino/escada";
import { FactosInquilino } from "@/components/inquilino/factos";
import { diaHabitual } from "@/components/inquilino/dados";
import { RegistarFolha } from "@/components/registar-folha";
import { getSession } from "@/lib/data";
import { lastMonthsKeys } from "@/lib/format";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { carregarFontesDoDiario } from "@/lib/portfolio/diario-load";
import { diarioDoInquilino } from "@/lib/portfolio/diario";
import { devedores, fichaDoInquilino } from "@/lib/portfolio/inquilinos";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import { linhasDeRendas, type LinhaDeRenda } from "@/lib/portfolio/rendas";

export const dynamic = "force-dynamic";

async function carregarFicha(chave: string) {
  const [{ supabase, isGestor }, { snap, raw }] = await Promise.all([getSession(), getSnapshotComRaw()]);
  const ficha = fichaDoInquilino(snap, chave);
  if (!ficha) notFound();
  const ids = ficha.contratos.map((c) => c.contract.id);
  const fontes = await carregarFontesDoDiario(supabase, ids);
  const diario = diarioDoInquilino(ids, fontes);
  const devedor = devedores(snap).find((d) => d.chave === chave);
  const linha: LinhaDeRenda = linhasDeRendas(snap, diario).find((l) => l.chave === chave) ?? {
    chave, nome: ficha.nome, fracoes: [...new Set(ficha.contratos.map((c) => nomeDaFracao(c.property)))],
    estado: "sem_informacao", valorEmAtraso: 0, mesesEmAtraso: 0, desde: null,
    rendaMensal: ficha.rendaMensal, aVigiar: [],
    tira: lastMonthsKeys(12, `${snap.hoje.slice(0, 7)}-01`).map((chave) => ({ chave, estado: "fora" })),
  };
  const atualizacao = raw.rentUpdates.filter((u) => ids.includes(u.contract_id) && u.effective_date <= snap.hoje)
    .map((u) => u.effective_date).sort().at(-1) ?? null;
  const datas = raw.payments.filter((p) => ids.includes(p.contract_id) && p.amount > 0)
    .map((p) => p.received_date);
  const manuais = fontes.movimentos.filter((m) => !m.voided && m.amount > 0).map((m) => m.received_date);
  const contratos = ficha.contratos.map(({ contract, property }) => ({
    contract, property, month: devedor?.contratos.find((c) => c.contract.id === contract.id)?.desde
      ?? `${snap.hoje.slice(0, 7)}-01`, expected: snap.expectedByContract[contract.id] ?? contract.rent,
  }));
  return { snap, ficha, linha, diario, devedor, atualizacao, contratos, isGestor,
    dia: diaHabitual([...datas, ...manuais], snap.hoje) };
}

function Contratos({ ficha }: { ficha: NonNullable<ReturnType<typeof fichaDoInquilino>> }) {
  if (ficha.contratos.length < 2) return null;
  return <Seccao titulo="Contratos"><div className="divide-y divide-regua">
    {ficha.contratos.map(({ contract, property }) => <Linha key={contract.id}
      href={`/fracoes/${property.id}`} titulo={nomeDaFracao(property)} sub={contract.pf_contract_no}
      valor={<Money value={contract.rent} />} etiqueta={contract.status === "ativo" ? "Ativo" : "Cessado"} />)}
  </div></Seccao>;
}

export default async function InquilinoPage({ params, searchParams }: {
  params: Promise<{ chave: string }>; searchParams: Promise<{ registar?: string }>;
}) {
  const [{ chave }, query] = await Promise.all([params, searchParams]);
  // A chave ("nome:..." ou "nif:...") chega codificada do URL; sem isto a ficha dá 404.
  const f = await carregarFicha(decodeURIComponent(chave));
  return <div className="mx-auto w-full max-w-2xl space-y-5 tabular-nums">
    <CabecalhoInquilino linha={f.linha} />
    <Tira meses={f.linha.tira} tamanho="m" rotulos />
    {f.isGestor && <RegistarFolha contratos={f.contratos} hoje={f.snap.hoje} abrir={query.registar === "1"} />}
    {f.devedor?.contratos.map((atraso) => <EscadaInquilino key={atraso.contract.id}
      atraso={atraso} diario={f.diario} hoje={f.snap.hoje} />)}
    {f.linha.aVigiar.length > 0 && <Seccao titulo="A vigiar">
      <div className="flex flex-wrap gap-2">{f.linha.aVigiar.map((motivo) => <Badge key={motivo} tone="perda">{motivo}</Badge>)}</div>
    </Seccao>}
    <DiarioInquilino eventos={f.diario} hoje={f.snap.hoje} />
    <FactosInquilino ficha={f.ficha} atualizacao={f.atualizacao} diaHabitual={f.dia} />
    <Contratos ficha={f.ficha} />
  </div>;
}
