// A tabela de Frações foi absorvida pela Faixa (PLANO.md §3): a lente Renda mostra
// inquilino, tipologia, área e €/m², com o histórico de cobrança que a tabela não tinha.
// A ficha de cada fração continua em /fracoes/[id].
import { redirect } from "next/navigation";

export default function FracoesPage() {
  redirect("/carteira?lente=renda");
}
