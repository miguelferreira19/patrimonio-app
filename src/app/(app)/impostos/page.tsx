// IMPOSTOS (plano de clareza, Fase 5): o IRS de cada ano e senhorio, o Anexo F e o AIMI.
// É a página do Ano, que já estava testada; aqui só ganha um destino próprio.
import AnoPage from "../ano/[ano]/page";

export const dynamic = "force-dynamic";

export default async function Impostos({ searchParams }: { searchParams: Promise<{ ano?: string; senhorio?: string }> }) {
  const sp = await searchParams;
  // Até junho o ano a declarar é o anterior.
  const agora = new Date();
  const ano = sp.ano && /^\d{4}$/.test(sp.ano) ? sp.ano : String(agora.getFullYear() - (agora.getMonth() < 6 ? 1 : 0));
  return <AnoPage params={Promise.resolve({ ano })} searchParams={Promise.resolve({ senhorio: sp.senhorio, emDinheiro: "1" })} />;
}
