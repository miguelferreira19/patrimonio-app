// O cartão de um prédio na vista Imóveis (V4 F4). Sem "use client".
import Link from "next/link";
import { Money } from "@/components/kit";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { EstadoPredio, ResumoPredio } from "@/lib/portfolio/imoveis";
import { Fachada } from "./fachada";
import { Meses } from "./meses";

const ESTADO: Record<EstadoPredio, { tom: "perda" | "futuro" | "atencao" | "neutro"; texto: string }> = {
  atraso: { tom: "perda", texto: "Em atraso" },
  parado: { tom: "futuro", texto: "Sem informação" },
  vaga: { tom: "atencao", texto: "Com vaga" },
  terreno: { tom: "neutro", texto: "Terreno" },
  vendido: { tom: "neutro", texto: "Vendido" },
  em_dia: { tom: "neutro", texto: "Em dia" },
};

/** Para onde leva o cartão: um prédio de uma fração salta direto para a ficha. */
export function destinoDoPredio(p: ResumoPredio): string {
  return p.fracoes.length === 1 ? `/fracoes/${p.fracoes[0].property.id}` : `/imoveis/${encodeURIComponent(p.chave)}`;
}

export function CartaoPredio({ p, back, scopeLabel }: { p: ResumoPredio; back?: string; scopeLabel?: string }) {
  const e = ESTADO[p.estado];
  const n = p.fracoes.length;
  const emAtraso = p.estado === "atraso";
  return (
    <Link
      href={destinoDoPredio(p) + (back ? `?voltar=${encodeURIComponent(back)}` : "")}
      className={cn(
        "cartao-link group block overflow-hidden rounded-2xl border bg-carta",
        // Um prédio com atraso levanta-se dos outros: borda e capa vermelhas (06/11).
        emAtraso ? "border-perda/35" : "border-regua",
      )}
    >
      <div className={cn("relative h-[88px]", emAtraso ? "bg-perda-tenue" : "bg-vellum")}>
        <Fachada chave={p.chave} fracoes={n} terreno={p.tipo === "terrenos" || p.estado === "terreno"} />
        <span className="absolute right-2.5 top-2.5">
          <Badge tone={e.tom}>{e.texto}</Badge>
        </span>
      </div>
      <div className="p-4">
        {scopeLabel && <p className="mb-2 text-[11px] text-tinta-3">{scopeLabel}</p>}
        <p className="truncate text-[15px] font-semibold text-tinta">{p.nome}</p>
        <p className="mt-0.5 truncate text-[13px] text-tinta-3">
          {p.morada ? `${p.morada} · ` : ""}
          {n === 1
            ? p.correntes === 0
              ? "fora da carteira corrente"
              : p.arrendadas === 1
                ? "arrendada"
                : "por arrendar"
            : `${n} frações${p.correntes > 0 ? ` · ${p.arrendadas} de ${p.correntes} arrendadas` : ""}`}
        </p>
        <div className="mt-3.5 flex items-center justify-between gap-3">
          {p.correntes > 0 ? <Meses meses={p.meses} /> : <span className="text-xs text-tinta-3">Sem arrendamento</span>}
          {p.divida > 0 ? (
            <span className="text-right">
              <Money value={p.divida} escala="lg" tom="perda" className="font-semibold" />
              <span className="block text-[11px] font-medium text-perda">em atraso</span>
            </span>
          ) : p.renda > 0 ? (
            <span className="text-sm">
              <Money value={p.renda} escala="md" />
              <span className="text-xs text-tinta-3">/mês</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
