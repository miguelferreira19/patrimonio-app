// O resultado de uma query do Supabase, ou uma exceção. NUNCA uma lista vazia por engano.
//
// Porque existe: o padrão `(q.data ?? []) as T[]` estava em 56 sítios e trata uma falha
// (rede, timeout, um 42501 de permissões) exatamente como "não há nada". Uma carteira
// vazia é um facto plausível, e por isso a falha passava por verdade: o Anexo F saía sem
// rendas, e o import gravava recibos órfãos que nenhum reimport volta a ligar.
//
// Lançar é o comportamento certo: o `error.tsx` do grupo (app) mostra a falha e deixa
// tentar de novo, e as server actions já devolvem `{ ok: false }` a partir de exceções.

// `error` opcional: os atalhos `{ data: [] }` (quando nem vale a pena perguntar) também servem.
type Resultado = { data: unknown; error?: { message: string } | null };

/** As linhas de uma query de lista. `onde` diz qual foi, para o erro se ler sozinho. */
export function linhas<T>(q: Resultado, onde: string): T[] {
  if (q.error) throw new Error(`Falhou a leitura de ${onde}: ${q.error.message}`);
  return (q.data ?? []) as T[];
}

/** A linha de um `.maybeSingle()`: `null` quando não existe, exceção quando a query falha. */
export function linha<T>(q: Resultado, onde: string): T | null {
  if (q.error) throw new Error(`Falhou a leitura de ${onde}: ${q.error.message}`);
  return (q.data ?? null) as T | null;
}
