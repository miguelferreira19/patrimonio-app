import Link from "next/link";
import { Download, FileSpreadsheet, Landmark, Percent, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, StatCard, Table, Td, Th } from "@/components/ui";
import {
  AIMI_THRESHOLD_COUPLE,
  AIMI_THRESHOLD_SINGLE,
  aimiExposure,
  anexoFRows,
  computeLandlordFiscalYear,
  expenseTotalsByProperty,
  reducedRateEligibility,
} from "@/lib/irs";
import { getSession } from "@/lib/data";
import { currentMonthKey, fmtEur, fmtPct, todayISO } from "@/lib/format";
import type { Contract, Expense, Landlord, Property, PropertyOwner, Receipt } from "@/lib/types";

export const dynamic = "force-dynamic";

const YEAR_WINDOW = 5;

export default async function IrsPage({
  searchParams,
}: {
  searchParams: Promise<{ landlord?: string; year?: string }>;
}) {
  const { supabase, isAdmin } = await getSession();
  const sp = await searchParams;

  const currentYear = parseInt(currentMonthKey().slice(0, 4), 10);
  const years = Array.from({ length: YEAR_WINDOW }, (_, i) => currentYear - i);
  const year = sp.year && years.includes(parseInt(sp.year, 10)) ? parseInt(sp.year, 10) : currentYear;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [landlordsQ, ownersQ, propsQ, contractsQ, receiptsQ, expensesQ] = await Promise.all([
    supabase.from("landlords").select("id,name").order("name"),
    supabase.from("property_owners").select("*"),
    supabase.from("properties").select("id,name,matriz_article,typology,vpt,status"),
    supabase.from("contracts").select("*"),
    supabase
      .from("receipts")
      .select("property_id,amount,withholding,issue_date")
      .gte("issue_date", yearStart)
      .lte("issue_date", yearEnd)
      .limit(5000),
    supabase
      .from("expenses")
      .select("property_id,category,amount,expense_date")
      .gte("expense_date", yearStart)
      .lte("expense_date", yearEnd)
      .limit(5000),
  ]);

  const landlords = (landlordsQ.data ?? []) as Array<Pick<Landlord, "id" | "name">>;
  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const properties = (propsQ.data ?? []) as Array<
    Pick<Property, "id" | "name" | "matriz_article" | "typology" | "vpt" | "status">
  >;
  const contracts = (contractsQ.data ?? []) as Contract[];
  const receipts = (receiptsQ.data ?? []) as Array<Pick<Receipt, "property_id" | "amount" | "withholding" | "issue_date">>;
  const expenses = (expensesQ.data ?? []) as Array<
    Pick<Expense, "property_id" | "category" | "amount" | "expense_date">
  >;

  const landlordId =
    sp.landlord && landlords.some((l) => l.id === sp.landlord) ? sp.landlord : (landlords[0]?.id ?? "");
  const landlord = landlords.find((l) => l.id === landlordId);

  const propertiesById = new Map(properties.map((p) => [p.id, p]));

  if (!landlord) {
    return (
      <div className="space-y-4">
        <PageHeader title="IRS" description="Apoio ao Anexo F por senhorio." />
        <EmptyState icon={Landmark}>Ainda não há senhorios registados.</EmptyState>
      </div>
    );
  }

  const quotaByProperty = new Map<string, number>();
  for (const o of owners) if (o.landlord_id === landlordId) quotaByProperty.set(o.property_id, o.quota ?? 100);

  const fy = computeLandlordFiscalYear(landlordId, year, owners, receipts, expenses);
  const rows = anexoFRows(landlordId, year, owners, contracts, propertiesById, receipts, expenses, todayISO());
  const aimi = aimiExposure(landlordId, owners, propertiesById);

  // P2-7: contratos ATIVOS deste senhorio elegíveis à taxa reduzida (independente de terem
  // rendas neste ano fiscal — é uma oportunidade a comunicar à AT, olha para o presente).
  const reducedList = contracts
    .filter((c) => c.status === "ativo" && quotaByProperty.has(c.property_id))
    .map((c) =>
      reducedRateEligibility(
        c,
        propertiesById.get(c.property_id)?.typology ?? null,
        quotaByProperty.get(c.property_id)!,
        todayISO(),
      ),
    )
    .filter((r) => r.eligibleRate !== null)
    .sort((a, b) => (b.annualSavings ?? 0) - (a.annualSavings ?? 0));

  // Despesas "a confirmar" (obras/outras) por fração — não deduzidas, só listadas.
  const expenseTotals = expenseTotalsByProperty(expenses, year);
  const toConfirmRows = Array.from(quotaByProperty.entries())
    .map(([propertyId, quotaPct]) => {
      const toConfirm = (expenseTotals.get(propertyId)?.toConfirm ?? 0) * (quotaPct / 100);
      return { propertyId, toConfirm };
    })
    .filter((r) => r.toConfirm > 0)
    .sort((a, b) => b.toConfirm - a.toConfirm);

  return (
    <div className="space-y-4">
      <PageHeader
        title="IRS"
        description="Mapa anual do Anexo F, simulação de regime e alertas fiscais por senhorio."
        actions={
          isAdmin && (
            <a
              href={`/api/irs?landlord=${landlordId}&year=${year}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <Download size={15} strokeWidth={1.75} />
              Exportar Anexo F
            </a>
          )
        }
      />

      <Card className="border-amber-200 bg-amber-50">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-800">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" strokeWidth={1.75} />
          Esta página mostra <strong>estimativas</strong> para apoio à decisão, não é
          aconselhamento fiscal vinculativo. Confirmar sempre no simulador da AT ou com
          contabilista antes de preencher a declaração real. Os escalões de englobamento
          respeitam a {fy.bracketsYear}; conferir se o ano mudou.
        </p>
      </Card>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <Field label="Senhorio">
          <Select name="landlord" defaultValue={landlordId} className="w-48">
            {landlords.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ano fiscal">
          <Select name="year" defaultValue={String(year)} className="w-28">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit">Ver</Button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Rendas ilíquidas" value={fmtEur(fy.grossRent)} sub={`${landlord.name} · ${year}`} icon={Landmark} />
        <StatCard label="Retenções na fonte" value={fmtEur(fy.withholding)} sub="crédito no Anexo F" tone="teal" />
        <StatCard
          label="Despesas dedutíveis"
          value={fmtEur(fy.deductibleExpenses)}
          sub="IMI + condomínio"
          tone="amber"
        />
        <StatCard
          label="Rendimento predial líquido"
          value={fmtEur(fy.netIncome)}
          sub="rendas − despesas dedutíveis"
          tone="teal"
        />
      </div>

      <Card
        title="Simulação de regime"
        subtitle="Taxa autónoma (28%) vs. englobamento: qual paga menos imposto"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            className={`rounded-lg border p-3 ${
              fy.bestRegime === "autonoma" ? "border-teal-300 bg-teal-50" : "border-zinc-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">Taxa autónoma (28%)</p>
              {fy.bestRegime === "autonoma" && <Badge tone="teal">Vence</Badge>}
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{fmtEur(fy.autonomousTax, 2)}</p>
          </div>
          <div
            className={`rounded-lg border p-3 ${
              fy.bestRegime === "englobamento" ? "border-teal-300 bg-teal-50" : "border-zinc-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">Englobamento (escalões {fy.bracketsYear})</p>
              {fy.bestRegime === "englobamento" && <Badge tone="teal">Vence</Badge>}
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{fmtEur(fy.englobedTax, 2)}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
          O englobamento acima trata o rendimento predial líquido como se fosse a única base
          tributável (sem quociente conjugal nem outras categorias de rendimento: pensões e
          salários somam-se na declaração real e podem empurrar para escalões mais altos). Serve
          para comparar a ordem de grandeza, não substitui o simulador da AT.
        </p>
      </Card>

      {toConfirmRows.length > 0 && (
        <Card
          title="Despesas a confirmar"
          subtitle="Categorias «Obras» e «Outras», não entram no líquido acima até se confirmar a natureza"
        >
          <Table>
            <thead>
              <tr>
                <Th>Fração</Th>
                <Th className="text-right">Valor (quota do senhorio)</Th>
              </tr>
            </thead>
            <tbody>
              {toConfirmRows.map((r) => (
                <tr key={r.propertyId} className="hover:bg-zinc-50">
                  <Td>
                    <Link href={`/fracoes/${r.propertyId}`} className="font-medium text-teal-700 hover:underline">
                      {propertiesById.get(r.propertyId)?.name ?? r.propertyId}
                    </Link>
                  </Td>
                  <Td className="text-right tabular-nums">{fmtEur(r.toConfirm, 2)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-[11px] text-zinc-400">
            «Obras» pode ser conservação/manutenção (dedutível) ou obra de valorização (não
            dedutível): a app não distingue as duas. Confirmar a fatura antes de somar ao Anexo F.
          </p>
        </Card>
      )}

      <Card title="Frações no Anexo F" subtitle={`${rows.length} contrato(s) com rendas ou despesas em ${year}`}>
        {rows.length === 0 ? (
          <EmptyState icon={FileSpreadsheet}>Sem rendas nem despesas dedutíveis neste ano.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fração</Th>
                <Th>Identificação matricial</Th>
                <Th className="text-right">Renda ilíquida</Th>
                <Th className="text-right">Retenção</Th>
                <Th className="text-right">Condomínio</Th>
                <Th className="text-right">IMI</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.contractId} className="hover:bg-zinc-50">
                  <Td>
                    <Link href={`/fracoes/${r.propertyId}`} className="font-medium text-teal-700 hover:underline">
                      {propertiesById.get(r.propertyId)?.name ?? r.propertyId}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs text-zinc-500">
                    {r.matriz.freguesia ?? "n/d"}-{r.matriz.tipo ?? "?"}-{r.matriz.artigo ?? "?"}
                    {r.matriz.fracaoSeccao ? `-${r.matriz.fracaoSeccao}` : ""}
                  </Td>
                  <Td className="text-right tabular-nums">{fmtEur(r.grossRent, 2)}</Td>
                  <Td className="text-right tabular-nums">{fmtEur(r.withholding, 2)}</Td>
                  <Td className="text-right tabular-nums">{fmtEur(r.condominio, 2)}</Td>
                  <Td className="text-right tabular-nums">{fmtEur(r.imi, 2)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card
        title="Taxa reduzida de longa duração (art. 72.º)"
        subtitle="Contratos de habitação ativos que já podiam beneficiar de taxa mais baixa que os 28%"
      >
        {reducedList.length === 0 ? (
          <EmptyState icon={Percent}>
            Nenhum contrato ativo deste senhorio atinge os 5 anos de duração (ou não é de
            habitação/tipologia por confirmar).
          </EmptyState>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Fração</Th>
                  <Th className="text-right">Anos de contrato</Th>
                  <Th className="text-right">Taxa possível</Th>
                  <Th className="text-right">Poupança estimada/ano</Th>
                </tr>
              </thead>
              <tbody>
                {reducedList.map((r) => (
                  <tr key={r.contractId} className="hover:bg-zinc-50">
                    <Td>
                      <Link href={`/fracoes/${r.propertyId}`} className="font-medium text-teal-700 hover:underline">
                        {propertiesById.get(r.propertyId)?.name ?? r.propertyId}
                      </Link>
                    </Td>
                    <Td className="text-right tabular-nums">{r.durationYears}</Td>
                    <Td className="text-right tabular-nums">
                      <Badge tone="green">{fmtPct(r.eligibleRate, 0)}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums text-emerald-700">{fmtEur(r.annualSavings, 2)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
              É um ALERTA, não altera nada sozinho. Para beneficiar, o contrato tem de ser
              comunicado à AT (Portaria n.º 110/2019, de 12/04). Comércio, lojas e garagens não
              beneficiam deste regime.
            </p>
          </>
        )}
      </Card>

      <Card title="Monitor de AIMI" subtitle="Soma do VPT por quota vs. limites do Adicional ao IMI">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            label="VPT total (quota do senhorio)"
            value={fmtEur(aimi.totalVpt)}
            sub="exclui frações vendidas e terrenos (presumidos rústicos)"
            tone={aimi.overSingle ? "amber" : "zinc"}
          />
          <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
            <p className="flex items-center justify-between">
              Limite pessoa singular ({fmtEur(AIMI_THRESHOLD_SINGLE)})
              <Badge tone={aimi.overSingle ? "amber" : "green"}>{aimi.overSingle ? "Excedido" : "Dentro"}</Badge>
            </p>
            <p className="mt-2 flex items-center justify-between">
              Limite casal, tributação conjunta ({fmtEur(AIMI_THRESHOLD_COUPLE)})
              <Badge tone={aimi.overCouple ? "amber" : "green"}>{aimi.overCouple ? "Excedido" : "Dentro"}</Badge>
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
          Só sinaliza exposição: distribuir propriedade por herdeiros para reduzir o AIMI é
          planeamento sucessório; remeter para contabilista, esta página não recomenda essa ação.
        </p>
      </Card>
    </div>
  );
}
