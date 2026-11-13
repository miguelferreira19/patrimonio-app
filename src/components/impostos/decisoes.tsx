import Link from "next/link";
import { Linha, Money, Seccao } from "@/components/kit";
import { Badge } from "@/components/ui";
import { AIMI_THRESHOLD_COUPLE, AIMI_THRESHOLD_SINGLE } from "@/lib/irs";
import { fmtPct } from "@/lib/format";
import type { AnoDoSenhorio } from "@/lib/portfolio/ano";

export default function Decisoes({ escolhido, nomes }: { escolhido: AnoDoSenhorio; nomes: Map<string, string> }) {
  const { fy, elegiveisArt72, poupancaArt72, prazoPorConfirmar } = escolhido;
  return <Seccao titulo="A decisão do ano">
    <div className="divide-y divide-regua">
      <div>
        <Linha titulo={fy.bestRegime === "autonoma" ? "Manter a taxa autónoma" : "Optar pelo englobamento no Anexo F"}
          valor={<Money value={Math.abs(fy.autonomousTax - fy.englobedTax)} />} />
        <details className="text-sm text-tinta-2"><summary className="inline-flex min-h-11 cursor-pointer items-center">Detalhes</summary>
          <p>Autónoma <Money value={fy.autonomousTax} /> contra englobamento <Money value={fy.englobedTax} />. A diferença é o que se poupa ao escolher o regime.</p>
          <p className="pb-3">O englobamento junta o rendimento predial aos escalões gerais de IRS; a app não conhece os outros rendimentos do agregado, por isso isto é uma estimativa do lado predial.</p>
        </details>
      </div>
      {elegiveisArt72.length > 0 && <div>
        <Linha titulo={`Comunicar ${elegiveisArt72.length} contratos à AT para a taxa reduzida do art. 72.º`}
          valor={<Money value={poupancaArt72} />} />
        <details className="text-sm text-tinta-2"><summary className="inline-flex min-h-11 cursor-pointer items-center">Detalhes</summary>
          <ul>{elegiveisArt72.map((e) => <li key={e.contract.id}>{nomes.get(e.contract.property_id) ?? "Fração"} · {e.anos} anos · {fmtPct(e.rate, 0)}</li>)}</ul>
          <p className="pb-3">(Taxa autónoma do contrato − taxa reduzida) × renda anual. A duração é a do prazo do contrato. Exige comunicação à AT, Portaria 110/2019.</p>
        </details>
      </div>}
      {prazoPorConfirmar > 0 && <Link href="/contratos?estado=desconhecido" className="flex min-h-11 flex-wrap items-center gap-2 py-3 text-sm">
        <Badge tone="futuro">{prazoPorConfirmar} contratos</Badge><span>Prazo por registar</span>
      </Link>}
      <Aimi escolhido={escolhido} />
    </div>
  </Seccao>;
}

function Aimi({ escolhido: { aimi } }: { escolhido: AnoDoSenhorio }) {
  return <div>
    <Linha titulo={aimi.overSingle ? "Confirmar o AIMI e deduzi-lo no quadro 9" : "Sem exposição a AIMI"}
      valor={<Money value={aimi.tax} />} />
    <details className="text-sm text-tinta-2"><summary className="inline-flex min-h-11 cursor-pointer items-center">Detalhes</summary>
      <p>VPT tributável <Money value={aimi.totalVpt} />. {aimi.excludedCount} frações isentas, no valor de <Money value={aimi.excludedVpt} />.</p>
      <p>Limite individual <Money value={AIMI_THRESHOLD_SINGLE} />, {aimi.overSingle ? "ultrapassado" : "não atingido"}; limite de casal <Money value={AIMI_THRESHOLD_COUPLE} />, {aimi.overCouple ? "ultrapassado" : "não atingido"}.</p>
      <p>Taxas marginais do art. 135.º-F: {fmtPct(0.007, 1)} acima de <Money value={600000} />, {fmtPct(0.01, 0)} acima de <Money value={1000000} /> e {fmtPct(0.015, 1)} acima de <Money value={2000000} />.</p>
      <p className="pb-3">Ficam de fora os rústicos e os urbanos de comércio, indústria ou serviços (art. 135.º-B n.º 2). O valor assume tributação separada; com tributação conjunta a dedução é do casal. Confirmar na nota da AT: é dedutível no quadro 9 do Anexo F.</p>
    </details>
  </div>;
}
