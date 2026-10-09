// UM PRÉDIO (V4, REDESENHO.md §4.2): as frações de uma morada, cada uma com o inquilino, os
// últimos meses e a renda. Um toque abre a ficha.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Meses } from "@/components/imoveis/meses";
import { Money } from "@/components/kit";
import { Badge } from "@/components/ui";
import { nomeProprio } from "@/lib/format";
import { getSnapshot } from "@/lib/portfolio";
import { MESES_NO_CARTAO, resumirPredios, type EstadoMes } from "@/lib/portfolio/imoveis";
import { emAtrasoDaCarteira } from "@/lib/portfolio/insights";

export const dynamic = "force-dynamic";

export default async function Predio({ params }: { params: Promise<{ chave: string }> }) {
  const { chave } = await params;
  const snap = await getSnapshot();
  const p = resumirPredios(snap).find((x) => x.chave === decodeURIComponent(chave));
  if (!p) notFound();

  const dividaDe = new Map(emAtrasoDaCarteira(snap).map((r) => [r.propertyId, r.debt]));
  const titulares = Array.from(
    new Set(p.fracoes.flatMap((f) => f.titulares.map((t) => t.landlord.name))),
  ).join(", ");

  return (
    <div className="space-y-6">
      <nav aria-label="Localização" className="text-[13px] text-tinta-3">
        <Link href="/imoveis" className="text-tinta-2 hover:text-tinta">
          Imóveis
        </Link>{" "}
        / {p.nome}
      </nav>
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] md:text-[30px]">{p.nome}</h1>
        <p className="mt-1.5 text-sm text-tinta-2">
          {p.morada ? `${p.morada} · ` : ""}
          {p.fracoes.length} frações
          {p.correntes > 0 && ` · ${p.arrendadas} de ${p.correntes} arrendadas`}
          {titulares && ` · ${titulares}`}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:max-w-xl">
        <div className="rounded-2xl border border-regua bg-carta px-4 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">Renda</p>
          <div className="mt-1.5">
            <Money value={p.renda} escala="xl" />
          </div>
          <p className="mt-1 text-xs text-tinta-3">por mês</p>
        </div>
        <div className="rounded-2xl border border-regua bg-carta px-4 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">Em atraso</p>
          <div className="mt-1.5">
            <Money value={p.divida} escala="xl" tom={p.divida > 0 ? "perda" : "tinta"} />
          </div>
          <p className="mt-1 text-xs text-tinta-3">meses anteriores</p>
        </div>
      </div>

      <ul className="divide-y divide-regua overflow-hidden rounded-2xl border border-regua bg-carta">
        {p.fracoes.map((f) => {
          const c = f.activeContract;
          const divida = dividaDe.get(f.property.id) ?? 0;
          const meses: EstadoMes[] = [
            ...f.faixa.slice(-(MESES_NO_CARTAO - 1)).map((m) => m.status),
            "curso",
          ];
          return (
            <li key={f.property.id}>
              <Link
                href={`/fracoes/${f.property.id}`}
                className="flex items-center gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-vellum md:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-tinta">{f.rotulo}</p>
                  <p className="truncate text-[13px] text-tinta-2">
                    {c ? nomeProprio(c.tenant_name) : f.corrente ? "Por arrendar" : "Fora da carteira corrente"}
                  </p>
                </div>
                {c && <Meses meses={meses} className="hidden sm:flex" />}
                <div className="w-24 shrink-0 text-right">
                  {divida > 0 ? (
                    <Badge tone="perda">
                      <Money value={divida} escala="sm" tom="perda" />
                    </Badge>
                  ) : c ? (
                    <span className="text-sm">
                      <Money value={c.rent} escala="md" />
                    </span>
                  ) : (
                    <Badge tone={f.corrente ? "atencao" : "neutro"}>{f.corrente ? "Vaga" : f.property.status === "vendido" ? "Vendida" : f.property.status === "terreno" ? "Terreno" : "Fora da carteira"}</Badge>
                  )}
                </div>
                <ChevronRight size={16} className="shrink-0 text-tinta-3" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
