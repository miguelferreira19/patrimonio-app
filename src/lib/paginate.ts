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

/** O mesmo, mas com o total sabido de antemão: dispara as páginas em PARALELO.
 *
 *  Porque existe: o `paginateAll` espera por cada página antes de pedir a seguinte. Com
 *  5.100 pagamentos são 6 idas ao Supabase EM SÉRIE, e o snapshot da V2 faz isso em TODAS
 *  as páginas — foi o que pôs as Frações e os Atrasos a "pensar". Com o total conhecido,
 *  paga-se uma latência em vez de seis.
 *
 *  ponytail: escrituras concorrentes entre a contagem e as leituras podem deslocar os
 *  offsets e fazer escapar uma linha. Nesta app há UM utilizador a escrever e as escritas
 *  são raras; a versão sequencial tem a mesma fragilidade. Se um dia houver escrita
 *  concorrente a sério, o caminho é uma view materializada, não mais paginação.
 */
export async function paginateAllParallel<T>(
  total: number,
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  if (total <= 0) return [];
  const nPaginas = Math.ceil(total / pageSize);
  const blocos = await Promise.all(
    Array.from({ length: nPaginas }, (_, i) =>
      fetchPage(i * pageSize, i * pageSize + pageSize - 1),
    ),
  );
  return blocos.flat();
}
