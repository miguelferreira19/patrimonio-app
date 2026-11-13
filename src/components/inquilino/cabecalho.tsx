import Link from "next/link";
import { Bloco, Money } from "@/components/kit";
import { monthLabel, nomeProprio } from "@/lib/format";
import type { LinhaDeRenda } from "@/lib/portfolio/rendas";

const TONS = { em_atraso: "perda", paga: "tinta", por_receber: "futuro", sem_informacao: "neutro" } as const;
const ESTADOS = { paga: "Em dia", por_receber: "Por receber", sem_informacao: "Sem informação", em_atraso: "Em atraso" };

export function CabecalhoInquilino({ linha }: { linha: LinhaDeRenda }) {
  return <Bloco tom={TONS[linha.estado]} tamanho="heroi">
    <Link href="/rendas" className="inline-flex min-h-11 items-center self-start text-sm font-semibold">‹ Rendas</Link>
    <div>
      <h1 className="break-words font-display text-[26px] font-bold leading-tight">{nomeProprio(linha.nome)}</h1>
      <div className="mt-1 text-sm">
        {linha.fracoes.join(" · ")} · <Money value={linha.rendaMensal} className="text-inherit" /> por mês
      </div>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="text-sm font-semibold">
        {linha.valorEmAtraso > 0 ? <>Deve {linha.mesesEmAtraso} {linha.mesesEmAtraso === 1 ? "mês" : "meses"},<br />
          desde {monthLabel(linha.desde!)}</> : "Estado"}
      </div>
      {linha.valorEmAtraso > 0 && <Money value={linha.valorEmAtraso} escala="hero"
        className="text-inherit text-[clamp(2rem,12vw,60px)]" />}
      {linha.valorEmAtraso === 0 && <div className="font-display text-3xl font-bold">{ESTADOS[linha.estado]}</div>}
    </div>
  </Bloco>;
}
