// O nível PRÉDIO (V4, REDESENHO.md §3.3). Módulo PURO, sem alterações de schema.
//
// A família pensa em casas ("o prédio da Azeredo Perdigão"), e a app só conhecia frações
// soltas com nomes como "5ESQ K" ou "RCESQ". O prédio já está escrito no artigo matricial:
// `182341-U-5077-C` é a fração C do artigo urbano 5077 da freguesia 182341. O prefixo de
// três partes é o prédio; o resto é a fração.
//
// Três regras, e o que nenhuma reconhecer fica como está (nunca se inventa um nome):
//   1. prédio = freguesia-U-artigo; rústicos (-R-) juntam-se em "Terrenos" por freguesia;
//      sem artigo, a fração fica sozinha;
//   2. morada = a mais frequente entre as frações, sem o "Nº:" do Portal e sem gritar;
//   3. nome da fração = o andar por extenso quando o nome (ou o artigo) é um código de
//      andar ("1POSDIR" → "1.º Post. Dto."); senão o nome que a família lhe deu.

export interface FracaoBase {
  property: {
    id: string;
    name: string;
    matriz_article: string | null;
    address: string | null;
    parish?: string | null;
    municipality?: string | null;
    typology?: string | null;
  };
}

export interface Predio<T extends FracaoBase> {
  chave: string;
  /** Como se chama o prédio: a morada normalizada, ou o nome próprio de uma casa isolada. */
  nome: string;
  /** A morada, quando o `nome` não é ela (casa isolada com nome próprio). */
  morada: string | null;
  tipo: "urbano" | "terrenos" | "sem_artigo";
  fracoes: Array<T & { rotulo: string }>;
}

import { nomeProprio } from "../format";

const semAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Alias local: a regra vive em format.ts (`nomeProprio`). */
export const semGritar = nomeProprio;

/** "RUA AZEREDO PERDIGÃO Nº: 68" → "Rua Azeredo Perdigão, 68";
 *  "Av. Almir. Afonso Cerqueira Lote: C2" → "Av. Almir. Afonso Cerqueira, lote C2". */
export function normalizarMorada(m: string | null | undefined): string | null {
  const t = (m ?? "").trim();
  if (!t) return null;
  return semGritar(t)
    .replace(/\s*N\.?º:?\s*/i, ", ")
    .replace(/\s*Lote:\s*/i, ", lote ")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*$/, "")
    .trim();
}

/** Chave e tipo do prédio a partir do artigo matricial. */
export function chaveDoPredio(
  matriz: string | null | undefined,
  id: string,
): { chave: string; tipo: Predio<FracaoBase>["tipo"] } {
  const m = (matriz ?? "").trim().toUpperCase();
  const partes = m.split("-");
  if (partes.length >= 3 && partes[1] === "R") return { chave: `terrenos:${partes[0]}`, tipo: "terrenos" };
  if (partes.length >= 3 && partes[1] === "U") return { chave: partes.slice(0, 3).join("-"), tipo: "urbano" };
  return { chave: `fracao:${id}`, tipo: "sem_artigo" };
}

/** Código de andar → por extenso. Reconhece "1ESQ", "1ºDIR", "5ºDIREITO", "RCESQ",
 *  "Rc Direito", "1 Posterior", "1º Frente", "1POSDIR", "2PESQ", "R/CPDT", "1ºFDT" e
 *  um sufixo de letra ("5ESQ K"). Devolve null quando não é um código de andar. */
export function andarPorExtenso(cru: string | null | undefined): string | null {
  const s = semAcentos((cru ?? "").toUpperCase()).replace(/[º°.]/g, "").replace(/\s+/g, " ").trim();
  const m = s.match(
    /^(R\/?C|\d{1,2})\s?(FRENTE|POSTERIOR|POS|F|P)?\s?(DIREITO|DIR|DTO|DT|D|ESQUERDO|ESQ|ES|E)?(?:\s([A-Z]))?$/,
  );
  if (!m || (!m[2] && !m[3] && m[1].match(/^\d+$/))) return null; // "2" sozinho não é um andar
  const piso = m[1].startsWith("R") ? "R/c" : `${parseInt(m[1], 10)}.º`;
  const posicao = m[2] ? (m[2].startsWith("F") ? "Frente" : "Post.") : null;
  const lado = m[3] ? (m[3].startsWith("D") ? "Dto." : "Esq.") : null;
  const letra = m[4] ? `(${m[4]})` : null;
  return [piso, posicao, lado, letra].filter(Boolean).join(" ");
}

const ROTULO_TIPO: Record<string, string> = { garagem: "Garagem", arrecadação: "Arrecadação" };

/** O nome de uma fração DENTRO do seu prédio. */
export function rotuloDaFracao(p: FracaoBase["property"]): string {
  const matriz = (p.matriz_article ?? "").trim();
  const nome = p.name.trim();
  const semNome = !nome || nome === matriz;
  const doNome = semNome ? null : andarPorExtenso(nome);
  if (doNome) return doNome;
  const sufixo = matriz.split("-").slice(3).join("-");
  const doArtigo = andarPorExtenso(sufixo);
  if (semNome) {
    if (matriz.includes("-R-")) return `Terreno ${matriz.split("-")[2] ?? matriz}`;
    if (doArtigo) return doArtigo;
    const tipo = ROTULO_TIPO[(p.typology ?? "").toLowerCase()];
    return sufixo ? `${tipo ?? "Fração"} ${sufixo}` : tipo ?? "Fração";
  }
  return semGritar(nome);
}

function maisFrequente(valores: string[]): string | null {
  const conta = new Map<string, number>();
  for (const v of valores) conta.set(v, (conta.get(v) ?? 0) + 1);
  let melhor: string | null = null;
  let n = 0;
  for (const [v, c] of conta) if (c > n) [melhor, n] = [v, c];
  return melhor;
}

/** Agrupa as frações por prédio. Ordem: prédios por nome; frações por rótulo. */
export function agruparPredios<T extends FracaoBase>(fracoes: T[]): Predio<T>[] {
  const grupos = new Map<string, { tipo: Predio<T>["tipo"]; itens: T[] }>();
  for (const f of fracoes) {
    const { chave, tipo } = chaveDoPredio(f.property.matriz_article, f.property.id);
    const g = grupos.get(chave) ?? { tipo, itens: [] };
    g.itens.push(f);
    grupos.set(chave, g);
  }
  const out: Predio<T>[] = [];
  for (const [chave, { tipo, itens }] of grupos) {
    const moradas = itens.map((f) => normalizarMorada(f.property.address)).filter((m): m is string => !!m);
    const morada = maisFrequente(moradas);
    const fracoesRot = itens
      .map((f) => ({ ...f, rotulo: rotuloDaFracao(f.property) }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt", { numeric: true }));
    let nome: string;
    let moradaAparte: string | null = null;
    if (tipo === "terrenos") {
      const local = itens.find((f) => f.property.parish)?.property.parish;
      nome = local ? `Terrenos · ${semGritar(local)}` : `Terrenos · ${chave.split(":")[1]}`;
    } else if (itens.length === 1 && !andarPorExtenso(itens[0].property.name) && itens[0].property.name !== itens[0].property.matriz_article) {
      // Casa isolada com nome próprio ("Tevisil", "Casa Toneca"): o nome é o que a família diz.
      nome = semGritar(itens[0].property.name.trim());
      moradaAparte = morada;
    } else {
      nome = morada ?? fracoesRot[0].rotulo;
    }
    out.push({ chave, nome, morada: moradaAparte, tipo, fracoes: fracoesRot });
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt", { numeric: true }));
}
