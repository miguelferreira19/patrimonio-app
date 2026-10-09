// PESQUISA GLOBAL (V4, REDESENHO.md §3.2). Módulo PURO: o índice e a procura.
//
// Procura-se o que a família sabe dizer: "camélias", "marta", "1.º esq", um NIF, um
// artigo. Sem acentos, sem maiúsculas, todas as palavras têm de aparecer (em qualquer
// ordem). O índice monta-se sobre o snapshot que já está em memória; nada vai à BD por
// cada tecla.

import { escopoSeguro } from "../documentos";
import { nomeProprio } from "../format";
import { chaveDoInquilino } from "./inquilinos";
import { agruparPredios, nomeDaFracao, type FracaoBase } from "./predios";

export type TipoResultado = "predio" | "fracao" | "inquilino" | "documento";

export interface ItemPesquisa {
  tipo: TipoResultado;
  titulo: string;
  sub: string;
  href: string;
  /** Texto normalizado onde se procura. */
  chave: string;
}

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[º°.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface FracaoParaIndice extends FracaoBase {
  activeContract: { tenant_name: string; tenant_nif: string | null } | null;
}

export function construirIndice(input: {
  ativos: FracaoParaIndice[];
  docs?: Array<{ escopo: string; nome: string; url: string | null }>;
  /** A ficha do inquilino é só de admin; para o viewer o inquilino leva à fração. */
  isAdmin: boolean;
}): ItemPesquisa[] {
  const itens: ItemPesquisa[] = [];
  const nomePorEscopo = new Map<string, string>();

  for (const p of agruparPredios(input.ativos)) {
    if (p.fracoes.length > 1) {
      itens.push({
        tipo: "predio",
        titulo: p.nome,
        sub: `${p.fracoes.length} frações`,
        href: `/imoveis/${encodeURIComponent(p.chave)}`,
        chave: normalizar(`${p.nome} ${p.morada ?? ""} ${p.chave}`),
      });
    }
    for (const f of p.fracoes) {
      const nome = nomeDaFracao(f.property);
      if (f.property.matriz_article) nomePorEscopo.set(escopoSeguro(f.property.matriz_article), nome);
      const inquilino = f.activeContract ? nomeProprio(f.activeContract.tenant_name) : null;
      itens.push({
        tipo: "fracao",
        titulo: nome,
        sub: inquilino ?? "Sem contrato ativo",
        href: `/fracoes/${f.property.id}`,
        chave: normalizar(`${nome} ${f.rotulo} ${f.property.name} ${f.property.matriz_article ?? ""} ${f.property.address ?? ""}`),
      });
      if (f.activeContract && inquilino) {
        itens.push({
          tipo: "inquilino",
          titulo: inquilino,
          sub: `${nome}${f.activeContract.tenant_nif ? ` · NIF ${f.activeContract.tenant_nif}` : ""}`,
          href: input.isAdmin
            ? `/inquilinos/${encodeURIComponent(chaveDoInquilino(f.activeContract))}`
            : `/fracoes/${f.property.id}`,
          chave: normalizar(`${f.activeContract.tenant_name} ${f.activeContract.tenant_nif ?? ""}`),
        });
      }
    }
  }

  for (const d of input.docs ?? []) {
    if (!d.url) continue;
    const onde = nomePorEscopo.get(d.escopo) ?? (d.escopo === "geral" ? "Geral" : d.escopo);
    itens.push({ tipo: "documento", titulo: d.nome, sub: onde, href: d.url, chave: normalizar(`${d.nome} ${onde}`) });
  }
  return itens;
}

const ORDEM_TIPO: Record<TipoResultado, number> = { predio: 0, fracao: 1, inquilino: 2, documento: 3 };

export function procurar(indice: ItemPesquisa[], q: string, max = 12): ItemPesquisa[] {
  const termos = normalizar(q).split(" ").filter(Boolean);
  if (termos.length === 0) return [];
  return indice
    // Cada termo no INÍCIO de uma palavra, e um número curto (andar, porta) só a palavra
    // INTEIRA: "esculca 2" é o 2.º andar, e com `includes` o "2" casava com os dígitos do
    // artigo matricial (182341-…) de todas as frações do prédio. NIF e artigo, com 3+
    // dígitos, continuam a casar pelo início.
    .filter((i) => {
      const palavras = i.chave.split(/[\s,·/-]+/);
      return termos.every((t) => {
        const exato = /^\d{1,2}$/.test(t);
        return palavras.some((w) => (exato ? w === t : w.startsWith(t)));
      });
    })
    .map((i) => ({ i, nota: normalizar(i.titulo).startsWith(termos[0]) ? 0 : 1 }))
    .sort((a, b) => a.nota - b.nota || ORDEM_TIPO[a.i.tipo] - ORDEM_TIPO[b.i.tipo] || a.i.titulo.localeCompare(b.i.titulo, "pt"))
    .slice(0, max)
    .map((x) => x.i);
}
