import { Download } from "lucide-react";
import { carregarAno } from "@/lib/portfolio/ano";
import { getSession } from "@/lib/data";
import { nomeProprio } from "@/lib/format";
import { nomeDaFracao } from "@/lib/portfolio/predios";
import { ExpensesClient } from "@/components/ano/despesas-client";
import { Lede, Pilulas } from "@/components/kit";
import { buttonClass, EmptyState } from "@/components/ui";
import Resumo from "./resumo";
import Decisoes from "./decisoes";
import Anexo from "./anexo";

export default async function AnoPage({ params, searchParams }: {
  params: Promise<{ ano: string }>; searchParams: Promise<{ senhorio?: string }>;
}) {
  const [{ ano: pedido }, sp, { isAdmin }] = await Promise.all([params, searchParams, getSession()]);
  const dados = await carregarAno(parseInt(pedido, 10));
  if (!dados.senhorios.length) return <EmptyState>Ainda não há senhorios registados.</EmptyState>;
  const escolhido = dados.porSenhorio.find((s) => s.landlord.id === sp.senhorio) ?? dados.porSenhorio[0];
  const nomes = new Map(dados.propriedades.map((p) => [p.id, nomeDaFracao(p)]));
  const destino = (ano: number, senhorio?: string) =>
    `/financas?tab=impostos&ano=${ano}${senhorio ? `&senhorio=${encodeURIComponent(senhorio)}` : ""}`;
  return <div className="space-y-6">
    <Lede title={`IRS ${dados.ano} · ${nomeProprio(escolhido.landlord.name)}`}
      actions={<a href={`/api/irs?landlord=${escolhido.landlord.id}&year=${dados.ano}`}
        className={buttonClass({ variant: "outline" })}><Download size={15} />Exportar Anexo F</a>} />
    <Resumo escolhido={escolhido} />
    <div data-print="none" className="space-y-2">
      <Pilulas ativo={String(dados.ano)} itens={dados.anos.map((a) => ({
        id: String(a), rotulo: String(a), href: destino(a, sp.senhorio),
      }))} />
      {dados.porSenhorio.length > 1 && <Pilulas ativo={escolhido.landlord.id}
        itens={dados.porSenhorio.map(({ landlord: s }) => ({ id: s.id,
          rotulo: nomeProprio(s.name), href: destino(dados.ano, s.id) }))} />}
    </div>
    <Decisoes escolhido={escolhido} nomes={nomes} />
    <Anexo escolhido={escolhido} nomes={nomes} />
    <details id="despesas"><summary className="flex min-h-11 cursor-pointer items-center text-lg font-semibold">Despesas</summary>
      <ExpensesClient expenses={dados.despesas} properties={dados.propriedades.map((p) => ({ id: p.id, name: nomeDaFracao(p) }))}
        landlords={dados.senhorios.map((s) => ({ ...s, name: nomeProprio(s.name) }))} isAdmin={isAdmin} currentYear={dados.ano} />
    </details>
  </div>;
}