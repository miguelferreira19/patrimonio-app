// O RETRATO da carteira: os números de relance, no topo do Agora.
//
// Porque voltou. A V2 tinha matado o dashboard e substituído os números por uma frase
// mais a fila de decisões. Para quem DECIDE isso é melhor — a fila diz o que fazer e
// quanto vale. Mas a app tem um segundo público: a família, que entra em modo viewer, não
// tem botão nenhum e ficava com um parágrafo. Para essa pessoa a pergunta não é "o que
// faço?", é "como é que isto está?", e essa não tinha resposta em lado nenhum.
//
// Não é o dashboard da V1 de volta: são seis números escolhidos, cada um com a sua
// unidade e o seu contexto, e nenhum "verde de ok" (regra fundadora do §10.1 — uma
// carteira sã é preta sobre papel).
//
// Sem hooks, logo sem "use client".

import { Figure, Money } from "@/components/kit";
import { cn } from "@/lib/cn";
import { fmtEur, fmtPct, monthLabel } from "@/lib/format";
import type { Snapshot } from "@/lib/portfolio";

export function Retrato({ snap, className }: { snap: Snapshot; className?: string }) {
  const emAtraso = snap.arrears.summary.contractsInArrears;
  const arrendadas = snap.correntes.filter((a) => a.activeContract).length;
  const recebidoMes = snap.fluxo[snap.fluxo.length - 1]?.recebido ?? 0;

  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-5 border-y border-regua py-4 md:grid-cols-3 lg:grid-cols-6",
        className,
      )}
    >
      <Numero
        label="Renda contratada"
        nota="por mês, a soma dos contratos ativos"
        valor={<Money value={snap.totais.rendaContratada} escala="lg" />}
      />
      <Numero
        label="Recebido"
        nota="últimos 12 meses"
        valor={<Money value={snap.totais.recebido12m} escala="lg" />}
      />
      <Numero
        label={`Entrou em ${monthLabel(snap.meses[snap.meses.length - 1], false)}`}
        nota="mês corrente, ainda a decorrer"
        valor={<Money value={recebidoMes} escala="lg" tom="tinta-2" />}
      />
      <Numero
        label="Ocupação"
        nota={`${arrendadas} de ${snap.correntes.length} frações arrendadas`}
        valor={<Figure value={fmtPct(snap.ocupacao.taxa, 0)} escala="lg" />}
      />
      <Numero
        label="Em atraso"
        nota={
          emAtraso === 0
            ? "nenhum contrato em atraso"
            : `${fmtEur(snap.risco.esperada)} de perda esperada`
        }
        valor={
          <Figure
            value={String(emAtraso)}
            unit={emAtraso === 1 ? "contrato" : "contratos"}
            escala="lg"
            tom={emAtraso > 0 ? "perda" : "tinta"}
          />
        }
      />
      <Numero
        label="Património"
        nota="VPT das frações, valor matricial"
        valor={<Money value={snap.totais.vptTotal} escala="lg" />}
      />
    </dl>
  );
}

function Numero({
  label,
  nota,
  valor,
}: {
  label: string;
  nota: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-[0.06em] text-tinta-3">{label}</dt>
      <dd className="mt-0.5">{valor}</dd>
      <dd className="mt-0.5 text-[11px] leading-snug text-tinta-3">{nota}</dd>
    </div>
  );
}
