import type { LinhaDeRenda } from "@/lib/portfolio/rendas";

const FILTROS = [
  { id: "em_atraso", rotulo: "Em atraso" },
  { id: "por_receber", rotulo: "Por receber" },
  { id: "paga", rotulo: "Pagas" },
  { id: "sem_informacao", rotulo: "Sem informação" },
  { id: "a_vigiar", rotulo: "A vigiar" },
] as const;

export function selecionarRendas(linhas: LinhaDeRenda[], estado?: string, registar = false) {
  const corresponde = (linha: LinhaDeRenda, filtro: string) =>
    filtro === "a_vigiar" ? linha.aVigiar.length > 0 : linha.estado === filtro;
  const ativo = FILTROS.some((f) => f.id === estado) ? estado! :
    linhas.some((l) => l.estado === "em_atraso") ? "em_atraso" : "por_receber";
  const pilulas = FILTROS.map((f) => ({ ...f, n: linhas.filter((l) => corresponde(l, f.id)).length,
    href: `/rendas?estado=${f.id}${registar ? "&registar=1" : ""}`,
  })).filter((f) => f.n > 0 || f.id === ativo);
  return { ativo, pilulas, linhas: registar ? linhas : linhas.filter((l) => corresponde(l, ativo)) };
}

export function correspondeAoNome(nome: string, pesquisa: string): boolean {
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-PT");
  return normalizar(nome).includes(normalizar(pesquisa));
}
