// A grelha de Pagamentos foi absorvida pela Faixa (PLANO.md §3, tabela de redirects).
// A lente Cobrança mostra o mesmo — e clicar numa célula continua a abrir o mesmo
// formulário de marcar pagamento, que mudou de casa para components/faixa/.
import { redirect } from "next/navigation";

export default function PagamentosPage() {
  redirect("/carteira?lente=cobranca");
}
