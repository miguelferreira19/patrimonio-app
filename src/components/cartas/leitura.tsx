import { Button, Field, Input } from "@/components/ui";
import type { Minuta, MinutaDados } from "@/lib/minutas";
import type { QueryCarta } from "./dados";

export function PlanoAcordo({ query, hoje }: { query: QueryCarta; hoje: string }) {
  return <form method="get" className="space-y-3 rounded-2xl bg-carta p-4">
    <Field label="Número de prestações"><Input name="prestacoes" type="number" min={1} max={24}
      defaultValue={query.prestacoes ?? "3"} required className="min-h-11" /></Field>
    <Field label="Data da primeira prestação"><Input name="primeira" type="date"
      defaultValue={query.primeira ?? hoje} required className="min-h-11" /></Field>
    <Button type="submit">Recalcular acordo</Button>
  </form>;
}

export function LeituraCarta({ minuta, dados }: { minuta: Minuta; dados: MinutaDados }) {
  return <article aria-label="Texto da minuta" className="space-y-6 break-words rounded-[20px] bg-carta p-5 text-base leading-relaxed">
    <header><div className="font-semibold">{dados.senhorio}</div>
      <div className="text-tinta-2">NIF {dados.senhorioNif ?? "Sem informação"}</div></header>
    <div><div className="font-semibold">{dados.inquilino}</div><div>{dados.morada}</div></div>
    <h2 className="font-semibold">{minuta.assunto}</h2>
    <div className="space-y-4">{minuta.paragrafos.map((p, i) => <p key={i}>{p}</p>)}</div>
    <footer className="space-y-6">{minuta.assinaturas.map((assinatura) =>
      <div key={assinatura} className="pt-6"><div className="mb-1 h-px bg-regua" />{assinatura}</div>)}</footer>
  </article>;
}
