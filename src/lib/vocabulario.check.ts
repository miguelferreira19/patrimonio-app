// Self-check do VOCABULÁRIO visível (AUDITORIA_CLAREZA.md, ponto 11). Corre com `npm run check`.
//
// O glossário único está documentado desde o PLANO_CLAREZA (§3) e mesmo assim a app usava
// cinco palavras para a mesma coisa: "em atraso", "em falta", "por pagar", "dívida" e
// "atrasado". Um documento não trava a deriva; um check trava.
//
// Ao contrário dos outros checks, este lê ficheiros do disco — é o único sítio onde a regra
// pode ser verificada, porque o que está errado são strings soltas em JSX, não um valor que
// um módulo puro devolva.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Termos proibidos na UI e o termo canónico que os substitui. */
const PROIBIDOS: Array<[RegExp, string]> = [
  // "em falta" NÃO entra: tem um sentido legítimo e diferente — um campo que falta numa
  // ficha, um documento por carregar. O glossário único é sobre DINHEIRO, e os três abaixo
  // são sempre a mesma coisa que "em atraso". Foi o check a mostrá-lo: acusou o cabeçalho
  // "Em falta" da tabela de fichas incompletas, que está certo.
  [/\bpor pagar\b/gi, "em atraso"],
  [/\bpor liquidar\b/gi, "em atraso"],
  [/\bem d[ií]vida\b/gi, "em atraso"],
];

/** Onde vive texto que o utilizador lê. */
const RAIZES = ["src/app", "src/components"];

/** Linhas que podem usar um termo proibido, com a razão. A lista é curta de propósito: se
 *  crescer, é sinal de que o glossário precisa de outra palavra, não de mais exceções. */
const EXCECOES: Array<[string, string]> = [
  // (ficheiro, excerto) — nenhuma de momento.
];

function ficheiros(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) return ficheiros(caminho);
    return e.name.endsWith(".tsx") ? [caminho] : [];
  });
}

/** Tira comentários e importações, que não são texto visível. Grosseiro de propósito: o
 *  objetivo é não acusar um comentário que EXPLICA a regra (este ficheiro inclui-se).
 *
 *  Substitui por quebras de linha, e não por um espaço: um bloco /* *\/ de cinco linhas
 *  colapsado num espaço desalinhava TODAS as linhas seguintes, e o check apontava para o
 *  sítio errado. Um aviso com a localização errada é pior do que não ter aviso. */
export function semComentarios(src: string): string {
  const mesmasLinhas = (m: string) => "\n".repeat((m.match(/\n/g) ?? []).length);
  return src
    .replace(/\/\*[\s\S]*?\*\//g, mesmasLinhas) // blocos /* */ e JSX {/* */}
    .replace(/^\s*\/\/.*$/gm, "") // linhas que são só comentário
    // ...e comentários no FIM da linha. O `[^:"'\\]` evita comer um `https://` dentro de
    // uma string, que é o único `//` que aparece em texto a sério.
    .replace(/([^:"'\\])\/\/[^\n]*/g, "$1")
    .replace(/^\s*import .*$/gm, "");
}

const achados: string[] = [];
for (const raiz of RAIZES) {
  for (const f of ficheiros(raiz)) {
    const limpo = semComentarios(readFileSync(f, "utf8"));
    for (const [termo, canonico] of PROIBIDOS) {
      for (const m of limpo.matchAll(termo)) {
        const linha = limpo.slice(0, m.index).split("\n").length;
        const excerto = limpo.split("\n")[linha - 1]?.trim().slice(0, 80) ?? "";
        if (EXCECOES.some(([ff, ex]) => f.endsWith(ff) && excerto.includes(ex))) continue;
        achados.push(`${f}:${linha} usa "${m[0]}" — o termo é "${canonico}": ${excerto}`);
      }
    }
  }
}

assert.deepEqual(achados, [], `vocabulário fora do glossário:\n${achados.join("\n")}`);

// E o próprio removedor de comentários tem de funcionar, senão o check passa por não ver nada.
{
  assert.equal(semComentarios("const a = 1; // por pagar").includes("por pagar"), false, "comentário no fim da linha");
  assert.equal(semComentarios("  // por pagar").includes("por pagar"), false, "linha só de comentário");
  assert.equal(semComentarios("/* por pagar */ const a = 1;").includes("por pagar"), false, "bloco");
  assert.equal(semComentarios("{/* por pagar */}").includes("por pagar"), false, "comentário JSX");
  assert.equal(semComentarios("<p>por pagar</p>").includes("por pagar"), true, "texto visível NÃO é removido");
  assert.equal(semComentarios('const u = "https://x.pt/por pagar";').includes("por pagar"), true, "um URL não é comentário");
  // As quebras de linha mantêm-se, senão a localização reportada aponta para o sítio errado.
  assert.equal(semComentarios("a\n/* um\ndois */\nb").split("\n").length, 4);
}

console.log(`vocabulario.check.ts: OK (${PROIBIDOS.length} termos proibidos, ${RAIZES.length} raízes)`);
