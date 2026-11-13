import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { MINUTAS, passoDaEscada } from "@/lib/minutas";
import { fmtDate } from "@/lib/format";
import { cartasDoCiclo } from "@/components/cartas";
import type { ContratoEmAtraso } from "@/lib/portfolio/inquilinos";
import type { EventoDoDiario } from "@/lib/portfolio/diario";
import { nomeDaFracao } from "@/lib/portfolio/predios";

const TIPOS = ["lembrete", "interpelacao", "resolucao"] as const;

export function EscadaInquilino({ atraso, diario, hoje }: {
  atraso: ContratoEmAtraso; diario: EventoDoDiario[]; hoje: string;
}) {
  const cartas = cartasDoCiclo(diario, atraso.contract.id, atraso.desde, hoje);
  const escada = passoDaEscada({ mesesEmAtraso: atraso.meses, cartas, hoje });
  const atual = escada.proxima ? TIPOS.indexOf(escada.proxima) : 2;
  return <section className="space-y-3 rounded-[20px] bg-perda-tenue p-4 text-perda-forte">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-lg font-bold">{escada.proxima ?
        `Próxima carta: ${MINUTAS[escada.proxima].label}` : "Escada concluída"}</h2>
      <span className="text-xs font-semibold tabular-nums">{atual + 1} de 3</span>
    </div>
    <div className="text-xs">{nomeDaFracao(atraso.property)}</div>
    <ol className="grid grid-cols-3 gap-1.5">{TIPOS.map((tipo) => {
      const enviada = cartas.some((c) => c.tipo === tipo);
      const estado = enviada ? "Enviada" : escada.proxima === tipo ? "A enviar" : "Por vir";
      return <li key={tipo} aria-label={`${MINUTAS[tipo].label}: ${estado}`}>
        <div className={`h-2 rounded ${enviada ? "bg-perda-forte" : escada.proxima === tipo ? "bg-perda" : "bg-papel"}`} />
        <span className="mt-1 block text-xs">{estado}</span>
      </li>;
    })}</ol>
    <div className="text-sm">{escada.motivo}</div>
    {escada.quando && escada.quando > hoje && <div className="text-xs">A partir de {fmtDate(escada.quando)}</div>}
    {escada.proxima && <Link href={`/cartas/${escada.proxima}/${atraso.contract.id}`}
      className={buttonClass({ variant: "danger" })}>Abrir a carta</Link>}
    <Link href={`/cartas/acordo/${atraso.contract.id}`} className="flex min-h-11 items-center text-sm font-semibold underline">
      Acordo de pagamento
    </Link>
  </section>;
}
