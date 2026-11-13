import { Bloco, Money, Seccao } from "@/components/kit";
import { Cascata, type Degrau } from "@/components/ano/cascata";
import type { AnoDoSenhorio } from "@/lib/portfolio/ano";

export default function Resumo({ escolhido }: { escolhido: AnoDoSenhorio }) {
  const { fy } = escolhido;
  const sobra = fy.netIncome - fy.bestTax;
  const degraus: Degrau[] = [
    { label: "Rendas documentadas", valor: fy.grossRent, tipo: "entrada" },
    { label: "Despesas dedutíveis", valor: fy.deductibleExpenses, tipo: "saida" },
    { label: "Rendimento líquido predial", valor: fy.netIncome, tipo: "saldo" },
    { label: `Imposto (${fy.bestRegime === "autonoma" ? "taxa autónoma" : "englobamento"})`, valor: fy.bestTax, tipo: "saida" },
    { label: "Sobra depois de imposto", valor: sobra, tipo: "saldo" },
  ];
  return <div className="space-y-3">
    <Bloco tom="tinta" tamanho="heroi" rotulo="Depois do imposto"
      valor={<Money value={sobra} escala="hero" className="text-inherit text-[length:inherit] md:text-[length:inherit]" />} />
    <div className="grid gap-3 sm:grid-cols-2">
      <Bloco tom="neutro" rotulo="Rendas ilíquidas" valor={<Money value={fy.grossRent} escala="xl" />} />
      <Bloco tom="futuro" rotulo="Imposto estimado" valor={<Money value={fy.bestTax} escala="xl" className="text-inherit" />}
        legenda={fy.bestRegime === "autonoma" ? "Taxa autónoma" : "Englobamento"} />
    </div>
    <Seccao titulo="Como o dinheiro do ano se decompõe"><Cascata degraus={degraus} /></Seccao>
    <details className="text-sm text-tinta-2">
      <summary className="inline-flex min-h-11 cursor-pointer items-center">Detalhes</summary>
      <div className="space-y-2 pb-3">
        <p>Recibos emitidos no ano, ilíquidos. Despesas dedutíveis registadas. Imposto antes de abater a retenção, com escalões de {fy.bracketsYear}.</p>
        <p>Retenção na fonte: <Money value={fy.withholding} />.</p>
        {fy.toConfirmExpenses > 0 && <p>Despesas a documentar, fora desta conta: <Money value={fy.toConfirmExpenses} />.</p>}
      </div>
    </details>
  </div>;
}
