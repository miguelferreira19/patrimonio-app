// O ARQUIVO da carteira. Módulo PURO: só a convenção de nomes, sem I/O.
//
// Os ficheiros vivem num bucket privado do Supabase Storage (`documentos`, criado no fim
// do schema.sql) e NÃO há tabela a indexá-los. O caminho é o índice:
//
//     <escopo>__<nome do ficheiro>
//
// `escopo` é o ARTIGO MATRICIAL da fração a que o documento pertence, ou `geral` para o
// que é da carteira inteira (declarações de IRS, correspondência, minutas assinadas).
// Tudo fica na raiz do bucket: com pastas a sério, desenhar esta página eram ~50 idas ao
// Supabase (uma por fração); com nomes planos é um `list()` e um agrupamento em memória.
//
// Porquê o artigo matricial e não o `property.id`: é o que está escrito nas cadernetas
// prediais, nos contratos e no Portal das Finanças. Os PDFs das cadernetas já vêm com o
// artigo no nome (`182341-U-5077-A.pdf`), e é isso que deixa o `escopoSugerido` arquivar
// 30 ficheiros de uma vez sem ninguém escolher nada.

export const BUCKET = "documentos";
export const GERAL = "geral";

/** Separador entre escopo e nome. Dois underscores porque um só aparece em nomes de
 *  ficheiro a sério ("caderneta_predial.pdf") e partiria o caminho ao meio. */
const SEP = "__";

/** Nome de ficheiro que o Storage aceita sem surpresas: sem acentos, sem espaços, sem o
 *  separador. Não é cosmética — uma chave com caracteres fora do ASCII imprimível dá 400
 *  no upload e o utilizador via só "falhou". */
export function nomeSeguro(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? nome; // nunca deixar passar caminho do disco
  return (
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[._]+/, "")
      .slice(0, 120) || "documento"
  );
}

/** Escopo seguro: mesma higiene, mas o separador nunca pode sobreviver lá dentro. */
export function escopoSeguro(escopo: string | null | undefined): string {
  const cru = (escopo ?? "").trim();
  if (cru === "") return GERAL;
  return nomeSeguro(cru).replace(/_/g, "-");
}

export function caminho(escopo: string | null | undefined, nome: string): string {
  return `${escopoSeguro(escopo)}${SEP}${nomeSeguro(nome)}`;
}

/** Inverso de `caminho`. Um objeto sem separador (carregado à mão pelo Supabase Studio,
 *  por exemplo) cai em `geral` em vez de desaparecer da listagem. */
export function partirCaminho(path: string): { escopo: string; nome: string } {
  const i = path.indexOf(SEP);
  if (i < 0) return { escopo: GERAL, nome: path };
  return { escopo: path.slice(0, i), nome: path.slice(i + SEP.length) };
}

/** Forma comparável de um artigo matricial: só letras e dígitos, tudo o resto vira `-`.
 *  Existe porque `182341-U-4260-1ºPES` chega dos dois lados escrito de maneira diferente
 *  (o `º` do artigo, o `_` a que o nome de ficheiro o reduz) e sem isto nunca casava. */
function chaveComparavel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A que fração pertence um ficheiro, a julgar pelo nome. Devolve o artigo matricial
 * quando o reconhece; `null` quando não há palpite (o formulário decide).
 *
 * Entre vários artigos que apareçam no nome ganha o MAIS COMPRIDO: `182341-U-3500-A` e
 * `182341-U-3500` são ambos artigos reais, e o palpite certo é o específico.
 */
export function escopoSugerido(nome: string, matrizes: Array<string | null>): string | null {
  const alvo = chaveComparavel(nome);
  let melhor: string | null = null;
  let melhorLen = 0;
  for (const m of matrizes) {
    if (!m) continue;
    const chave = chaveComparavel(m);
    if (chave.length === 0 || !alvo.includes(chave)) continue;
    if (chave.length > melhorLen) {
      melhor = m;
      melhorLen = chave.length;
    }
  }
  return melhor;
}
