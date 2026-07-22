/** Junta todas as páginas de uma fonte paginada. Necessário porque o Supabase/PostgREST corta
 *  a resposta ao max-rows do servidor (~1000 linhas) MESMO com .limit() alto — ler >1000 linhas
 *  de uma vez perde linhas em silêncio (foi o que punha contratos inteiros a "nunca" na página
 *  de Atrasos). `fetchPage(from, to)` devolve o bloco [from, to] inclusive (semântica .range()).
 *  Para quando uma página vem mais curta que pageSize (a última) ou vazia. */
export async function paginateAll<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}
