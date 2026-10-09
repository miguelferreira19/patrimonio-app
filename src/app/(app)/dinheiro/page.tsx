import { redirect } from "next/navigation";

// V4 F1: o destino Dinheiro abre o IRS do ano até a F6 o substituir (REDESENHO.md §4.4).
export default function Dinheiro() {
  redirect(`/ano/${new Date().getFullYear()}`);
}
