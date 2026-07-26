// As Despesas passaram a ser um bloco do documento do Ano (PLANO.md §3), onde ganham o
// contexto que lhes faltava: quanto do que se gastou é dedutível e o que isso vale no
// imposto do ano.
import { redirect } from "next/navigation";

export default function DespesasPage() {
  redirect(`/ano/${new Date().getFullYear()}#despesas`);
}
