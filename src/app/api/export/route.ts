// Cópia de segurança da carteira em .xlsx (PLANO.md P1-7): uma folha por tabela.
// Route handler em vez de server action porque o download é um simples <a href> — sem
// JS de cliente, sem base64, sem estado. Só admin (requireAdmin lança se não for).
import { requireAdmin } from "@/lib/actions/util";
import { paginateAll } from "@/lib/paginate";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

// [tabela, coluna de ordenação]. A ordem é obrigatória: sem ela a paginação por .range()
// pode repetir ou saltar linhas. property_owners não tem `id` (chave composta).
const TABLES: Array<[string, string]> = [
  ["landlords", "id"],
  ["properties", "id"],
  ["property_owners", "property_id"],
  ["contracts", "id"],
  ["receipts", "id"],
  ["payments", "id"],
  ["expenses", "id"],
];

export async function GET() {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Sem permissão.", { status: 403 });
  }

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  for (const [table, orderBy] of TABLES) {
    const rows = await paginateAll<Record<string, unknown>>(async (from, to) => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(orderBy)
        .range(from, to);
      if (error) throw new Error(`${table}: ${error.message}`);
      return (data ?? []) as Record<string, unknown>[];
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), table.slice(0, 31));
  }

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="patrimonio-${todayISO()}.xlsx"`,
    },
  });
}
