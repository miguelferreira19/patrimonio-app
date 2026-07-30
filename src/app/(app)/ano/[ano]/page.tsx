// O ANO (PLANO.md §3 e §11): "quanto ganhámos, quanto vamos pagar, que decisão tomar?".
//
// É um DOCUMENTO, não um dashboard: lê-se de cima a baixo, pela ordem em que a pergunta
// se resolve — quanto entrou, quanto se gastou, quanto se retém, que regime paga menos e
// porquê, que contratos comunicar à AT, exposição a AIMI, e as despesas em detalhe.
// Imprime-se para a família (§11).
//
// Server component. O senhorio e o ano vivem no URL, por isso um link leva alguém
// diretamente ao mesmo documento.

import Link from "next/link";
import { Download } from "lucide-react";
import { carregarAno } from "@/lib/portfolio/ano";
import { getSession } from "@/lib/data";
import { Cascata, type Degrau } from "@/components/ano/cascata";
import { ExpensesClient } from "@/components/ano/despesas-client";
import { Lede, Money, Seccao } from "@/components/kit";
import { Badge, buttonClass, EmptyState, Table, Td, Th } from "@/components/ui";
import { cn } from "@/lib/cn";
import { AIMI_THRESHOLD_COUPLE, AIMI_THRESHOLD_SINGLE } from "@/lib/irs";
import { fmtEur, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AnoPage({
  params,
  searchParams,
}: {
  params: Promise<{ ano: string }>;
  searchParams: Promise<{ senhorio?: string }>;
}) {
  const [{ ano: anoParam }, sp, { isAdmin }] = await Promise.all([
    params,
    searchParams,
    getSession(),
  ]);
  const dados = await carregarAno(parseInt(anoParam, 10));

  if (dados.senhorios.length === 0) {
    return (
      <div className="space-y-4">
        <Lede eyebrow={`IRS ${dados.ano}`} title="Ainda não há senhorios registados." />
        <EmptyState>Importa os recibos do Portal das Finanças no Admin para começar.</EmptyState>
      </div>
    );
  }

  const escolhido =
    dados.porSenhorio.find((s) => s.landlord.id === sp.senhorio) ?? dados.porSenhorio[0];
  const { fy, aimi, anexoF, elegiveisArt72, poupancaArt72 } = escolhido;

  const nomePorFracao = new Map(dados.propriedades.map((p) => [p.id, p.name]));
  const poupancaRegime = Math.abs(fy.autonomousTax - fy.englobedTax);
  const sobra = fy.netIncome - fy.bestTax;

  const degraus: Degrau[] = [
    { label: "Rendas recebidas", valor: fy.grossRent, tipo: "entrada", nota: "recibos emitidos no ano, ilíquidos" },
    {
      label: "Despesas dedutíveis",
      valor: fy.deductibleExpenses,
      tipo: "saida",
      nota:
        fy.toConfirmExpenses > 0
          ? `mais ${fmtEur(fy.toConfirmExpenses)} por confirmar, fora desta conta`
          : undefined,
    },
    { label: "Rendimento líquido predial", valor: fy.netIncome, tipo: "saldo" },
    {
      label: `Imposto (${fy.bestRegime === "autonoma" ? "taxa autónoma 28%" : "englobamento"})`,
      valor: fy.bestTax,
      tipo: "saida",
      nota: `escalões de ${fy.bracketsYear}`,
    },
    { label: "Sobra depois de imposto", valor: sobra, tipo: "saldo" },
  ];

  return (
    <div className="space-y-6">
      <Lede
        eyebrow={`IRS ${dados.ano}`}
        title={
          <>
            {escolhido.landlord.name} recebeu <Money value={fy.grossRent} tom="tinta" /> e fica com{" "}
            <Money value={sobra} tom="tinta" /> depois do imposto.
          </>
        }
        actions={
          <a
            href={`/api/irs?landlord=${escolhido.landlord.id}&year=${dados.ano}`}
            className={buttonClass({ variant: "outline" })}
          >
            <Download size={15} strokeWidth={1.75} />
            Exportar Anexo F
          </a>
        }
      >
        {fy.withholding > 0
          ? `Foram retidos ${fmtEur(fy.withholding)} na fonte, que se abatem ao imposto apurado. O regime mais barato é ${fy.bestRegime === "autonoma" ? "a taxa autónoma" : "o englobamento"}, por ${fmtEur(poupancaRegime)}.`
          : `Não houve retenção na fonte. O regime mais barato é ${fy.bestRegime === "autonoma" ? "a taxa autónoma" : "o englobamento"}, por ${fmtEur(poupancaRegime)}.`}
      </Lede>

      {/* Seletores: ano e senhorio, ambos como links. Fora da impressão: em papel são
          botões mortos, e o ano já está no cabeçalho do documento. */}
      <div
        data-print="none"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-regua py-2"
      >
        <div className="flex flex-wrap gap-1">
          {dados.anos.map((a) => (
            <Link
              key={a}
              href={`/ano/${a}${sp.senhorio ? `?senhorio=${sp.senhorio}` : ""}`}
              aria-current={a === dados.ano ? "page" : undefined}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs tabular-nums transition-colors",
                a === dados.ano
                  ? "bg-acao-tenue font-medium text-acao"
                  : "text-tinta-2 hover:bg-elevado hover:text-tinta",
              )}
            >
              {a}
            </Link>
          ))}
        </div>
        {dados.porSenhorio.length > 1 && (
          <>
            <span className="h-4 w-px bg-regua" />
            <div className="flex flex-wrap gap-1">
              {dados.porSenhorio.map((s) => (
                <Link
                  key={s.landlord.id}
                  href={`/ano/${dados.ano}?senhorio=${s.landlord.id}`}
                  aria-current={s.landlord.id === escolhido.landlord.id ? "page" : undefined}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs transition-colors",
                    s.landlord.id === escolhido.landlord.id
                      ? "bg-acao-tenue font-medium text-acao"
                      : "text-tinta-2 hover:bg-elevado hover:text-tinta",
                  )}
                >
                  {s.landlord.name}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Seccao titulo="Como o dinheiro do ano se decompõe">
          <Cascata degraus={degraus} />
        </Seccao>

        <Seccao titulo="A decisão do ano" nota="o que fazer com este ano fiscal">
          <ol className="space-y-4">
            <Decisao
              n={1}
              titulo={
                fy.bestRegime === "autonoma"
                  ? "Manter a taxa autónoma de 28%"
                  : "Optar pelo englobamento no Anexo F"
              }
              euros={poupancaRegime}
              porque={`Autónoma ${fmtEur(fy.autonomousTax)} contra englobamento ${fmtEur(fy.englobedTax)}. A diferença é o que se poupa ao escolher bem.`}
              conta="O englobamento junta o rendimento predial aos escalões gerais de IRS; a app não conhece os outros rendimentos do agregado, por isso isto é uma estimativa do lado predial."
            />
            {elegiveisArt72.length > 0 && (
              <Decisao
                n={2}
                titulo={`Comunicar ${elegiveisArt72.length} ${elegiveisArt72.length === 1 ? "contrato" : "contratos"} à AT para a taxa reduzida do art. 72.º`}
                euros={poupancaArt72}
                porque={`${elegiveisArt72
                  .slice(0, 3)
                  .map((e) => `${e.propertyName} (${e.anos} anos, ${fmtPct(e.rate, 0)})`)
                  .join(", ")}${elegiveisArt72.length > 3 ? `, e outros ${elegiveisArt72.length - 3}` : ""}.`}
                conta="(28% − taxa elegível) × renda anual. Exige comunicação à AT, Portaria 110/2019; sem ela a taxa não se aplica."
              />
            )}
            <Decisao
              n={elegiveisArt72.length > 0 ? 3 : 2}
              titulo={
                aimi.overSingle
                  ? "Confirmar o AIMI e deduzi-lo no quadro 9"
                  : "Sem exposição a AIMI"
              }
              euros={0}
              porque={`VPT imputado ${fmtEur(aimi.totalVpt)}. Limite individual ${fmtEur(AIMI_THRESHOLD_SINGLE)}${
                aimi.overSingle ? ", ultrapassado" : ", não atingido"
              }; limite de casal ${fmtEur(AIMI_THRESHOLD_COUPLE)}${
                aimi.overCouple ? ", ultrapassado" : ", não atingido"
              }.`}
              conta="A app não calcula o AIMI em euros de propósito: a taxa e o limite dependem de se opta pela tributação conjunta, e isso ela não sabe. Diz o VPT e que limites são cruzados; o valor confirma-se na nota da AT. É dedutível no quadro 9 do Anexo F."
            />
          </ol>
        </Seccao>
      </section>

      <Seccao
        titulo="Anexo F, quadro 4.1"
        nota={`${anexoF.length} ${anexoF.length === 1 ? "linha" : "linhas"}, com a quota de ${escolhido.landlord.name} já aplicada.`}
      >
        {anexoF.length === 0 ? (
          <EmptyState>Sem rendas declaradas neste ano para este senhorio.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Fração</Th>
                  <Th>Matriz</Th>
                  <Th className="text-right">Rendas</Th>
                  <Th className="text-right">Retenção</Th>
                  <Th className="text-right">Condomínio + IMI</Th>
                  <Th>Taxa</Th>
                </tr>
              </thead>
              <tbody>
                {anexoF.map((r) => (
                  <tr key={r.contractId}>
                    <Td>{nomePorFracao.get(r.propertyId) ?? "fração"}</Td>
                    <Td className="font-mono text-xs">
                      {[r.matriz.freguesia, r.matriz.tipo, r.matriz.artigo, r.matriz.fracaoSeccao]
                        .filter(Boolean)
                        .join("-") || "por preencher"}
                    </Td>
                    <Td className="text-right tabular-nums">{fmtEur(r.grossRent, 2)}</Td>
                    <Td className="text-right tabular-nums">{fmtEur(r.withholding, 2)}</Td>
                    <Td className="text-right tabular-nums">
                      {fmtEur(r.condominio + r.imi, 2)}
                    </Td>
                    <Td>
                      {r.reduced.eligibleRate ? (
                        <Badge tone="teal">{fmtPct(r.reduced.eligibleRate, 0)}</Badge>
                      ) : (
                        <Badge tone="zinc">28%</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-tinta-3">
          As rendas são o valor ILÍQUIDO do recibo; o líquido é rendas menos retenção. Somar a
          retenção ao ilíquido sobre-declara o rendimento: foi o bug B1, e está coberto no
          irs.check.ts.
        </p>
      </Seccao>

      <section id="despesas" className="scroll-mt-6">
        <ExpensesClient
          expenses={dados.despesas}
          properties={dados.propriedades.map((p) => ({ id: p.id, name: p.name }))}
          landlords={dados.senhorios}
          isAdmin={isAdmin}
          currentYear={dados.ano}
        />
      </section>
    </div>
  );
}

/** Um degrau da decisão: título, o que vale, porquê e a conta. Um valor sem conta visível
 *  não se mostra (PLANO.md §6.4). */
function Decisao({
  n,
  titulo,
  euros,
  porque,
  conta,
}: {
  n: number;
  titulo: string;
  euros: number;
  porque: string;
  conta: string;
}) {
  return (
    <li className="border-l-2 border-regua pl-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-medium text-tinta">
          <span className="mr-1.5 font-mono text-xs text-tinta-3">{n}.</span>
          {titulo}
        </p>
        {euros > 0 && <Money value={euros} escala="sm" tom="acao" className="shrink-0" />}
      </div>
      <p className="mt-0.5 text-sm text-tinta-2">{porque}</p>
      <p className="mt-1 text-xs text-tinta-3">{conta}</p>
    </li>
  );
}
