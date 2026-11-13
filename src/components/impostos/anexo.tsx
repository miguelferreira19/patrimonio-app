import { Money, Seccao } from "@/components/kit";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui";
import { fmtPct, nomeProprio } from "@/lib/format";
import type { AnoDoSenhorio } from "@/lib/portfolio/ano";

export default function Anexo({ escolhido, nomes }: { escolhido: AnoDoSenhorio; nomes: Map<string, string> }) {
  const { anexoF, landlord } = escolhido;
  return <Seccao titulo="Anexo F, quadro 4.1" valor={<span className="text-sm tabular-nums">{anexoF.length} linhas</span>}>
    {anexoF.length === 0 ? <EmptyState>Sem rendas declaradas neste ano para este senhorio.</EmptyState> :
      <div className="max-w-full overflow-x-auto"><Table>
        <thead><tr><Th>Fração</Th><Th>Matriz</Th><Th className="text-right">Rendas</Th>
          <Th className="text-right">Retenção</Th><Th className="text-right">Condomínio + IMI</Th><Th>Taxa</Th></tr></thead>
        <tbody>{anexoF.map((r) => <tr key={r.contractId}>
          <Td>{nomes.get(r.propertyId) ?? "Fração"}</Td>
          <Td className="font-mono text-xs">{[r.matriz.freguesia, r.matriz.tipo, r.matriz.artigo, r.matriz.fracaoSeccao].filter(Boolean).join("-") || "por preencher"}</Td>
          <Td className="text-right"><Money value={r.grossRent} decimals={2} /></Td>
          <Td className="text-right"><Money value={r.withholding} decimals={2} /></Td>
          <Td className="text-right"><Money value={r.condominio + r.imi} decimals={2} /></Td>
          <Td><Badge tone="confirmado">{fmtPct(r.reduced.eligibleRate ?? r.taxaAutonoma, 0)}</Badge></Td>
        </tr>)}</tbody>
      </Table></div>}
    <details className="text-sm text-tinta-2"><summary className="inline-flex min-h-11 cursor-pointer items-center">Detalhes</summary>
      <p>Quota de {nomeProprio(landlord.name)} já aplicada. As rendas são o valor ilíquido do recibo; o líquido é rendas menos retenção.</p>
    </details>
  </Seccao>;
}
