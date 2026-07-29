// Ficha de ARRENDATÁRIO. A fração já tinha página; a pessoa que a paga não tinha, e é
// dela que vêm as perguntas todas ("este paga sempre?", "quanto é que já nos deu?").
//
// A chave vem no URL e é a mesma de `concentracao().porInquilino` (renda.ts): `nif:...`
// quando há NIF, `nome:...` quando não há. Sem NIF, a ficha pode estar a juntar homónimos
// e DIZ-LO — a app não finge que o inquilino é uma entidade quando não é (V3.md).

import { notFound } from "next/navigation";
import Link from "next/link";
import { Home } from "lucide-react";
import { Confianca, Figure, Lede, Money, Seccao } from "@/components/kit";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui";
import { getSession } from "@/lib/data";
import { getSnapshot } from "@/lib/portfolio";
import { fichaDoInquilino } from "@/lib/portfolio/inquilinos";
import { SEVERITY_LABEL } from "@/lib/arrears";
import { fmtDate, fmtEur, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InquilinoPage({ params }: { params: Promise<{ chave: string }> }) {
  // Aberta a TODA a gente (decisao do utilizador, 2026-07-29): a familia ja ve nomes de
  // inquilinos na fracao e na Carteira com a lente de risco, e o nome era clicavel para
  // todos — com guarda de admin, um viewer que clicasse era atirado para o Agora sem
  // explicacao. Ou se esconde o link, ou se abre a pagina; escondido, o nome do inquilino
  // ficava a ser a unica coisa da app sem para onde ir.
  await getSession();

  const { chave } = await params;
  const snap = await getSnapshot();
  const ficha = fichaDoInquilino(snap, decodeURIComponent(chave));
  if (!ficha) notFound();

  const contratosAtivos = ficha.contratos.filter((c) => c.contract.status === "ativo");
  const meses = ficha.desde ? mesesDesde(ficha.desde, snap.hoje) : null;

  return (
    <div className="space-y-6">
      <Lede
        eyebrow={ficha.ativos > 0 ? "Arrendatário" : "Arrendatário (sem contrato ativo)"}
        title={<Money value={ficha.rendaMensal} escala="hero" />}
      >
        {ficha.nome}
        {ficha.nif ? ` · NIF ${ficha.nif}` : ""}
        {ficha.ativos > 0
          ? ` · ${ficha.ativos} ${ficha.ativos === 1 ? "contrato ativo" : "contratos ativos"}`
          : ""}
        {ficha.cessados > 0 ? ` · ${ficha.cessados} cessado${ficha.cessados === 1 ? "" : "s"}` : ""}
        {meses !== null && ` · há ${meses} ${meses === 1 ? "mês" : "meses"} na carteira`}
        {ficha.porNome && (
          <>
            {" "}
            <Confianca
              nivel="assumido"
              conta="Este contrato não tem NIF: a ficha agrupa por NOME normalizado (minúsculas, sem acentos). Dois arrendatários com o mesmo nome apareceriam aqui como um só. Preenche o NIF no contrato para a ficha passar a ser certa."
            />
          </>
        )}
      </Lede>

      <Seccao titulo="Comportamento">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Facto rotulo="Recebido (12 meses)" valor={<Money value={ficha.recebido12m} escala="lg" />} />
          <Facto
            rotulo="Em dívida"
            valor={<Money value={ficha.divida} escala="lg" tom={ficha.divida > 0 ? "perda" : "tinta-2"} />}
          />
          <Facto
            rotulo="Estado"
            valor={
              <span className="text-[15px] font-medium text-tinta">
                {ficha.severidade ? SEVERITY_LABEL[ficha.severidade] : "n/d"}
              </span>
            }
          />
          <Facto
            rotulo="Probabilidade de pagar"
            valor={
              ficha.pPagar === null ? (
                <span className="text-[15px] text-tinta-3">por saber</span>
              ) : (
                <Figure value={fmtPct(ficha.pPagar, 0)} escala="lg" />
              )
            }
          />
        </dl>
        <p className="mt-3 text-xs text-tinta-3">
          O recebido são os 12 meses da janela da carteira, não o histórico todo. A dívida e o
          estado são só dos contratos ATIVOS: o que ficou por pagar num contrato cessado não se
          cobra a quem já saiu. A probabilidade é a do risco da carteira (Beta-Binomial com
          shrinkage), ponderada pela renda de cada contrato.
        </p>
      </Seccao>

      <Seccao titulo="Contratos" valor={<Money value={ficha.rendaMensal} escala="sm" tom="tinta-2" />}>
        {ficha.contratos.length === 0 ? (
          <EmptyState icon={Home}>Sem contratos.</EmptyState>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Fração</Th>
                    <Th>Início</Th>
                    <Th>Fim</Th>
                    <Th className="text-right">Renda</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Em dívida</Th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.contratos.map(({ contract, property, arrears }) => (
                    <tr key={contract.id}>
                      <Td>
                        <Link href={`/fracoes/${property.id}`} className="font-medium text-tinta hover:text-acao">
                          {property.name}
                        </Link>
                      </Td>
                      <Td className="tabular-nums">{fmtDate(contract.start_date)}</Td>
                      <Td className="tabular-nums">{contract.end_date ? fmtDate(contract.end_date) : "·"}</Td>
                      <Td className="text-right tabular-nums">{fmtEur(contract.rent)}</Td>
                      <Td>
                        {contract.status === "ativo" ? (
                          <Badge tone="green">Ativo</Badge>
                        ) : (
                          <Badge tone="zinc">Cessado</Badge>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {arrears && arrears.debt > 0 ? fmtEur(arrears.debt) : "·"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {/* Mobile: um cartão por contrato. */}
            <ul className="space-y-2 md:hidden">
              {ficha.contratos.map(({ contract, property, arrears }) => (
                <li key={contract.id} className="rounded-xl border border-regua p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/fracoes/${property.id}`} className="font-medium text-tinta">
                      {property.name}
                    </Link>
                    <Money value={contract.rent} className="shrink-0" />
                  </div>
                  <p className="mt-1 text-xs text-tinta-3 tabular-nums">
                    {fmtDate(contract.start_date)}
                    {contract.end_date ? ` a ${fmtDate(contract.end_date)}` : " até hoje"}
                    {contract.status !== "ativo" && " · cessado"}
                    {arrears && arrears.debt > 0 && ` · ${fmtEur(arrears.debt)} em dívida`}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Seccao>

      {contratosAtivos.length > 0 && (
        <Seccao titulo="Ritmo de pagamento">
          <ul className="space-y-2">
            {contratosAtivos.map(({ contract, property, arrears }) => (
              <li key={contract.id} className="rounded-xl border border-regua p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-tinta">{property.name}</p>
                  <p className="text-xs text-tinta-2">
                    {arrears
                      ? `${SEVERITY_LABEL[arrears.severity]}${arrears.streak > 0 ? ` · ${arrears.streak} ${arrears.streak === 1 ? "mês" : "meses"} seguidos por liquidar` : ""}${arrears.cadence ? ` · paga de ${arrears.cadence} em ${arrears.cadence} meses` : ""}`
                      : "sem leitura de atrasos"}
                  </p>
                </div>
                {arrears?.lastPaidMonth && (
                  <p className="mt-1 text-xs text-tinta-3">
                    Último mês totalmente pago: <span className="tabular-nums">{arrears.lastPaidMonth.slice(0, 7)}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Seccao>
      )}
    </div>
  );
}

function Facto({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">{rotulo}</dt>
      <dd className="mt-1">{valor}</dd>
    </div>
  );
}

/** Meses inteiros entre duas datas ISO. Formatação, não regra de negócio. */
function mesesDesde(desdeISO: string, hojeISO: string): number {
  const a = new Date(`${desdeISO.slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${hojeISO.slice(0, 10)}T00:00:00Z`);
  const m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  return Math.max(0, m);
}
