import Link from "next/link";
import { Bloco, Figure, Seccao } from "@/components/kit";
import { EmptyState, Table, Td, Th } from "@/components/ui";
import { fmtNum, nomeProprio } from "@/lib/format";
import type { atrasoDeEmissao } from "@/lib/controlo";
import type { Contract } from "@/lib/types";
import { ligacaoDoContrato } from "./modelo";

type Emissao = ReturnType<typeof atrasoDeEmissao>;
const dias = (n: number) => fmtNum(n, Number.isInteger(n) ? 0 : 1);

export function Contas({ emissao }: { emissao: Emissao }) {
  return <Seccao titulo="Dias até à emissão">
    <div className="space-y-3">{[...emissao.porConta].map(([conta, m]) =>
      <Bloco key={conta} tom="neutro" rotulo={nomeProprio(conta)}
        valor={m.n ? <Figure value={dias(m.mediana)} unit="dias" escala="xl" /> : "Sem medição"}
        legenda={<>{m.n > 0 && `mediana de ${dias(m.mediana)} dias · `}{m.n} recibos medidos · {m.semMedicao} sem medição</>}>
        <span className="mt-2 text-xs text-tinta-2">precisão de 3 a 4 dias</span>
      </Bloco>)}</div>
    {!emissao.porConta.size && <EmptyState>Ainda não há recibos medidos.</EmptyState>}
  </Seccao>;
}

export function PorInquilino({ emissao, contratos }: { emissao: Emissao; contratos: Contract[] }) {
  const linhas = [...emissao.porContrato].filter(([, m]) => m.n > 0)
    .sort((a, b) => b[1].mediana - a[1].mediana || a[0].localeCompare(b[0])).slice(0, 15);
  return <Seccao titulo="Emissão por inquilino">
    {linhas.length ? <div className="max-w-full overflow-x-auto"><Table>
      <thead><tr><Th>Inquilino</Th><Th className="text-right">Mediana (dias)</Th><Th className="text-right">n</Th></tr></thead>
      <tbody>{linhas.map(([numero, m]) => {
        const href = ligacaoDoContrato(numero, contratos);
        const nome = nomeProprio(contratos.find((c) => c.pf_contract_no === numero)?.tenant_name);
        return <tr key={numero}><Td>{href ? <Link className="inline-flex min-h-11 items-center" href={href}>{nome}</Link> : numero}</Td>
          <Td className="text-right tabular-nums">{dias(m.mediana)}</Td><Td className="text-right tabular-nums">{m.n}</Td></tr>;
      })}</tbody>
    </Table></div> : <EmptyState>Ainda não há contratos com medição.</EmptyState>}
  </Seccao>;
}
