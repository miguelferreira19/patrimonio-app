// O IRS foi absorvido pelo documento do Ano (PLANO.md §3). O /ano/[ano] tem a cascata, a
// decisão do ano, o art. 72.º, o AIMI e o mesmo quadro 4.1 do Anexo F, com o mesmo
// `/api/irs` para exportar.
import { redirect } from "next/navigation";

export default function IrsPage() {
  redirect(`/ano/${new Date().getFullYear()}`);
}
