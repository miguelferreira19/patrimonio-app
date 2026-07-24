// Export do Anexo F por senhorio/ano (PLANO.md P2-2/P2-6). Route handler em vez de server
// action pelo mesmo motivo do /api/export: download simples via <a href>, sem JS de cliente.
// DECISÃO DO UTILIZADOR (2026-07-23): a folha "Anexo F" replica a estrutura real de quadros do
// Modelo 3 (ver dados/Pai/IRS_PAI.pdf) — numeração de quadros, colunas e "Campos" — para servir
// de apoio direto ao preenchimento. Os cálculos vêm de src/lib/irs.ts (mesma fonte da página
// `(app)/irs`, nunca duplicados aqui).
import { requireAdmin } from "@/lib/actions/util";
import {
  AIMI_THRESHOLD_COUPLE,
  AIMI_THRESHOLD_SINGLE,
  aimiExposure,
  anexoFRows,
  computeLandlordFiscalYear,
  expenseTotalsByProperty,
  reducedRateEligibility,
} from "@/lib/irs";
import { todayISO } from "@/lib/format";
import type { Contract, Expense, Landlord, Property, PropertyOwner, Receipt } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = (string | number | null)[];

// Remove acentos para um nome de ficheiro seguro: "António" -> "Antonio".
// \p{Diacritic} (com a flag "u") apanha as marcas que sobram depois de decompor
// acentos (NFD), sem precisar de escrever o intervalo de combining marks à mão.
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function GET(request: Request) {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Sem permissão.", { status: 403 });
  }

  const url = new URL(request.url);
  const landlordId = url.searchParams.get("landlord");
  if (!landlordId) return new Response("Falta o parâmetro landlord.", { status: 400 });
  const yearParam = parseInt(url.searchParams.get("year") ?? "", 10);
  const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();

  const landlordQ = await supabase.from("landlords").select("id,name,nif").eq("id", landlordId).single();
  const landlord = landlordQ.data as Pick<Landlord, "id" | "name" | "nif"> | null;
  if (!landlord) return new Response("Senhorio não encontrado.", { status: 404 });

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [ownersQ, propsQ, contractsQ, receiptsQ, expensesQ] = await Promise.all([
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

  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const properties = (propsQ.data ?? []) as Array<
    Pick<Property, "id" | "name" | "matriz_article" | "typology" | "vpt" | "status">
  >;
  const contracts = (contractsQ.data ?? []) as Contract[];
  const receipts = (receiptsQ.data ?? []) as Array<Pick<Receipt, "property_id" | "amount" | "withholding" | "issue_date">>;
  const expenses = (expensesQ.data ?? []) as Array<
    Pick<Expense, "property_id" | "category" | "amount" | "expense_date">
  >;

  const propertiesById = new Map(properties.map((p) => [p.id, p]));
  const quotaByProperty = new Map<string, number>();
  for (const o of owners) if (o.landlord_id === landlord.id) quotaByProperty.set(o.property_id, o.quota ?? 100);

  const fy = computeLandlordFiscalYear(landlord.id, year, owners, receipts, expenses);
  const rows = anexoFRows(landlord.id, year, owners, contracts, propertiesById, receipts, expenses, todayISO());
  const aimi = aimiExposure(landlord.id, owners, propertiesById);
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
    .filter((r) => r.eligibleRate !== null);
  const expenseTotals = expenseTotalsByProperty(expenses, year);
  const toConfirm = Array.from(quotaByProperty.entries())
    .map(([propertyId, quotaPct]) => ({
      propertyId,
      amount: Math.round((expenseTotals.get(propertyId)?.toConfirm ?? 0) * (quotaPct / 100) * 100) / 100,
    }))
    .filter((r) => r.amount > 0);

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // ---------- Folha 1: "Anexo F" — estrutura oficial (Quadro 4.1 + gastos + Quadro 9) ----------
  const aoa: Row[] = [];
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
  const mergeTitle = (text: string, span: number) => {
    const r = aoa.length;
    const row: Row = new Array(span).fill(null);
    row[0] = text;
    aoa.push(row);
    merges.push({ s: { r, c: 0 }, e: { r, c: span - 1 } });
  };

  mergeTitle("MODELO 3 · ANEXO F · RENDIMENTOS PREDIAIS (CATEGORIA F)", 11);
  aoa.push([`Sujeito passivo: ${landlord.name}${landlord.nif ? `  ·  NIF ${landlord.nif}` : ""}`]);
  aoa.push([`Ano dos rendimentos: ${year}`]);
  aoa.push([]);

  mergeTitle("QUADRO 4.1 · CONTRATOS DE ARRENDAMENTO QUE NÃO BENEFICIAM DO REGIME DE REDUÇÃO DE TAXA (ART.º 72.º DO CIRS)", 11);
  aoa.push([
    "Campo", "Nº contrato", "Data de início", "Freguesia", "Tipo", "Artigo", "Fração/Secção",
    "Titular", "Valor ilíquido", "Retenções na fonte", "NIF arrendatário",
  ]);
  const campoByProperty = new Map<string, number>();
  let campo = 4001;
  let totalGross = 0;
  let totalWithholding = 0;
  for (const r of rows) {
    campoByProperty.set(r.propertyId, campo);
    aoa.push([
      campo, r.pfContractNo ?? "", r.startDate ?? "", r.matriz.freguesia ?? "", r.matriz.tipo ?? "",
      r.matriz.artigo ?? "", r.matriz.fracaoSeccao ?? "", "A", r.grossRent, r.withholding, "",
    ]);
    totalGross += r.grossRent;
    totalWithholding += r.withholding;
    campo += 1;
  }
  aoa.push(["TOTAIS", "", "", "", "", "", "", "", Math.round(totalGross * 100) / 100, Math.round(totalWithholding * 100) / 100, ""]);
  aoa.push([]);

  mergeTitle("Gastos suportados e pagos (mesmos Campos do quadro acima)", 7);
  aoa.push(["Campo", "Conservação e manutenção", "Condomínio", "Imposto municipal sobre imóveis", "Imposto do selo", "Taxas autárquicas", "Outros"]);
  campo = 4001;
  let totalCondominio = 0;
  let totalImi = 0;
  for (const r of rows) {
    aoa.push([campo, 0, r.condominio, r.imi, 0, 0, 0]);
    totalCondominio += r.condominio;
    totalImi += r.imi;
    campo += 1;
  }
  aoa.push(["TOTAIS", 0, Math.round(totalCondominio * 100) / 100, Math.round(totalImi * 100) / 100, 0, 0, 0]);
  aoa.push([]);
  aoa.push([
    "Nota: \"Conservação e manutenção\" fica sempre 0, despesas da categoria «Obras» são ambíguas " +
      "(conservação dedutível vs. valorização não dedutível) e aparecem à parte na folha «Notas», por " +
      "confirmar antes de somar. «Natureza», «NIF arrendatário» e «Atualização da renda superior a 1,02?» " +
      "não são determináveis a partir dos dados da app, preencher a partir do Portal das Finanças.",
  ]);
  aoa.push([]);

  mergeTitle("QUADRO 9 · DEDUÇÃO À COLETA · ADICIONAL AO IMI [alínea i) do n.º 1 do art.º 78.º do CIRS]", 3);
  aoa.push(["Quadro/Campo", "Fração", "Valor Patrimonial Tributário"]);
  for (const [propertyId, quotaPct] of quotaByProperty) {
    const p = propertiesById.get(propertyId);
    if (!p || !p.vpt || p.status === "vendido" || p.status === "terreno") continue;
    const ref = campoByProperty.get(propertyId);
    aoa.push([ref ? `Q4.1 / ${ref}` : "", p.name, Math.round(p.vpt * (quotaPct / 100) * 100) / 100]);
  }
  aoa.push(["", "TOTAL (estimativa app)", aimi.totalVpt]);
  aoa.push([
    "Nota: o valor efetivamente liquidado de Adicional ao IMI é calculado pela AT sobre TODOS os " +
      "prédios urbanos do NIF a nível nacional, a soma acima é só o VPT das frações desta app, para " +
      "referência. Ver folha «Notas» para os limiares.",
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(aoa);
  ws1["!merges"] = merges;
  ws1["!cols"] = [
    { wch: 10 }, { wch: 14 }, { wch: 13 }, { wch: 11 }, { wch: 8 }, { wch: 10 }, { wch: 13 },
    { wch: 9 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "Anexo F");

  // ---------- Folha 2: Notas (fora da estrutura oficial) ----------
  const notas: Row[] = [];
  notas.push(["ESTIMATIVAS de apoio à decisão, não é aconselhamento fiscal vinculativo."]);
  notas.push(["Confirmar sempre no simulador da AT ou com contabilista antes de submeter a declaração real."]);
  notas.push([]);
  notas.push(["Simulação de regime (rendimento predial líquido tratado isoladamente)"]);
  notas.push(["Rendimento predial líquido", fy.netIncome]);
  notas.push(["Imposto, taxa autónoma 28%", fy.autonomousTax]);
  notas.push([`Imposto, englobamento (escalões ${fy.bracketsYear})`, fy.englobedTax]);
  notas.push(["Melhor opção", fy.bestRegime === "autonoma" ? "Taxa autónoma (28%)" : "Englobamento"]);
  notas.push([]);
  notas.push(["Despesas a confirmar (categorias «Obras» e «Outras», NÃO somadas ao Anexo F acima)"]);
  notas.push(["Fração", "Valor (quota do senhorio)"]);
  if (toConfirm.length === 0) notas.push(["Nenhuma."]);
  for (const t of toConfirm) notas.push([propertiesById.get(t.propertyId)?.name ?? t.propertyId, t.amount]);
  notas.push([]);
  notas.push(["Taxa reduzida de longa duração, art.º 72.º (contratos ativos de habitação elegíveis)"]);
  notas.push(["Fração", "Anos de contrato", "Taxa possível", "Poupança estimada/ano"]);
  if (reducedList.length === 0) notas.push(["Nenhum contrato elegível."]);
  for (const r of reducedList) {
    notas.push([
      propertiesById.get(r.propertyId)?.name ?? r.propertyId,
      r.durationYears,
      r.eligibleRate,
      r.annualSavings,
    ]);
  }
  notas.push(["Alerta apenas, exige comunicação à AT (Portaria n.º 110/2019, de 12/04). Comércio/garagens não beneficiam."]);
  notas.push([]);
  notas.push(["Monitor de AIMI"]);
  notas.push(["VPT total (quota do senhorio, exclui vendidas e terrenos)", aimi.totalVpt]);
  notas.push(["Limite pessoa singular", AIMI_THRESHOLD_SINGLE, aimi.overSingle ? "Excedido" : "Dentro do limite"]);
  notas.push(["Limite casal (tributação conjunta)", AIMI_THRESHOLD_COUPLE, aimi.overCouple ? "Excedido" : "Dentro do limite"]);
  notas.push(["Sinalização apenas, distribuir propriedade por herdeiros é planeamento sucessório, remeter para contabilista."]);

  const ws2 = XLSX.utils.aoa_to_sheet(notas);
  ws2["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Notas");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const filename = `AnexoF_${slug(landlord.name)}_${year}.xlsx`;
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
