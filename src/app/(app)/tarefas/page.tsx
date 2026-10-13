import { CasesPage, type CaseQuery } from "@/components/gestao/casos";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<CaseQuery> }) { return <CasesPage kind="tarefa" q={await searchParams} />; }
