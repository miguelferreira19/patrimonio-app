// Os Atrasos foram absorvidos pela Faixa (PLANO.md §3). A lente Risco traz a dívida
// estimada e o streak; o filtro `atraso` deixa só os contratos com meses em falta.
import { redirect } from "next/navigation";

export default function AtrasosPage() {
  redirect("/carteira?lente=risco&filtro=atraso");
}
