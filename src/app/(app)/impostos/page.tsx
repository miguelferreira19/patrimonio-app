import { redirect } from "next/navigation";
import { destinoImpostos } from "@/components/financas/modelo";

export default async function Impostos({ searchParams }: {
  searchParams: Promise<{ ano?: string; senhorio?: string }>;
}) {
  redirect(destinoImpostos(await searchParams));
}