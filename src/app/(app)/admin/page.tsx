import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { getSession } from "@/lib/data";
import { isCurrentProperty, missingFichaFields } from "@/lib/calc";
import type { Landlord, MarketBenchmark, Profile, Property, UpdateCoefficient } from "@/lib/types";
import { CoefficientsCard } from "./coefficients-card";
import { FichasCard, type FichaPorPreencher } from "./fichas-card";
import { IneCard } from "./ine-card";
import { LargarFicheiro } from "@/components/importar/largar-ficheiro";
import { SyncRentsCard } from "./sync-rents-card";
import { UsersCard } from "./users-card";
import { linhas } from "@/lib/supabase/dados";
import { paginateAll } from "@/lib/paginate";

export const dynamic = "force-dynamic";

/** Linha parcial de market_benchmarks só com os campos usados para agregar o painel INE. */
interface IneBenchmarkRow {
  period: string;
  source: string;
  level: string;
  fetched_at: string;
}

export default async function AdminPage() {
  const { supabase, isAdmin, user } = await getSession();

  // Admin-only com REDIRECT, nao com um cartao "area reservada": e a regra escrita no
  // CLAUDE.md e o que /analise e /inquilinos ja faziam. Tres paginas a divergir do documento
  // e o que faz o proximo a ler o repo confiar numa guarda que nao existe como pensa.
  if (!isAdmin || !user) {
    redirect("/");
  }

  const [
    landlordsQ,
    profilesQ,
    propertiesCountQ,
    contractsCountQ,
    receiptsCountQ,
    ineBenchQ,
    manualBenchQ,
    coefficientsQ,
    propertiesQ,
  ] = await Promise.all([
    supabase.from("landlords").select("*").order("name"),
    supabase.from("profiles").select("*"),
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("contracts").select("id", { count: "exact", head: true }),
    supabase.from("receipts").select("id", { count: "exact", head: true }),
    // PAGINADO: uma linha por território e período; passa das 1000 no próximo trimestre.
    paginateAll<IneBenchmarkRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("market_benchmarks")
        .select("period,source,level,fetched_at")
        .eq("source", "ine")
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw new Error(`Falhou a leitura de market_benchmarks (INE): ${error.message}`);
      return (data ?? []) as IneBenchmarkRow[];
    }),
    supabase.from("market_benchmarks").select("*").eq("source", "manual").order("dicofre"),
    supabase.from("update_coefficients").select("*"),
    supabase
      .from("properties")
      .select("id,name,area_m2,typology,dicofre,vpt,status")
      .order("name"),
  ]);

  const landlords = linhas<Landlord>(landlordsQ, "landlords");
  const profiles = linhas<Profile>(profilesQ, "profiles");
  const manualBenchmarks = linhas<MarketBenchmark>(manualBenchQ, "market_benchmarks (manuais)");
  const ineRows = ineBenchQ;
  const coefficients = linhas<UpdateCoefficient>(coefficientsQ, "update_coefficients");

  // Só as frações CORRENTES: um terreno sem área e um imóvel vendido não bloqueiam análise
  // nenhuma, e enchiam a lista de linhas que nunca se vão preencher (P0-2c).
  const fichas: FichaPorPreencher[] = (linhas<Property>(propertiesQ, "properties"))
    .filter(isCurrentProperty)
    .map((p) => ({
      id: p.id,
      name: p.name,
      emFalta: missingFichaFields(p),
      area_m2: p.area_m2,
      typology: p.typology,
      vpt: p.vpt,
    }))
    .filter((f) => f.emFalta.length > 0);

  const nProperties = propertiesCountQ.count ?? 0;
  const nContracts = contractsCountQ.count ?? 0;
  const nReceipts = receiptsCountQ.count ?? 0;

  const ineCount = ineRows.length;
  const inePeriods = Array.from(new Set(ineRows.map((r) => r.period))).sort((a, b) =>
    b.localeCompare(a),
  );
  const ineLastFetch = ineRows.reduce<string | null>(
    (max, r) => (!max || r.fetched_at > max ? r.fetched_at : max),
    null,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Admin"
        description={`${nProperties} frações · ${nContracts} contratos · ${nReceipts} recibos`}
      />

      <LargarFicheiro landlords={landlords} />

      <FichasCard fichas={fichas} />

      <SyncRentsCard />

      <IneCard
        ineCount={ineCount}
        inePeriods={inePeriods}
        ineLastFetch={ineLastFetch}
        manualBenchmarks={manualBenchmarks}
      />

      <CoefficientsCard coefficients={coefficients} />

      <UsersCard profiles={profiles} meId={user.id} />

      <Card title="Cópia de segurança">
        <p className="text-sm text-tinta-2">
          Descarrega a carteira toda num ficheiro Excel: frações, contratos, recibos, pagamentos,
          despesas, senhorios e quotas, uma folha por tabela. Os dados vivem só no Supabase; guarda
          uma cópia de vez em quando.
        </p>
        <a
          href="/api/export"
          className="mt-3 inline-block text-sm font-medium text-acao hover:underline"
        >
          Descarregar .xlsx
        </a>
      </Card>

      <Card title="Notas">
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-tinta-2">
          <li>
            Para criar acessos da família: no dashboard do Supabase, vai a{" "}
            <strong>Authentication → Add user</strong> (email + password). O primeiro utilizador
            registado fica administrador; os seguintes ficam com acesso de leitura e podem ser
            promovidos aqui em cima.
          </li>
        </ul>
      </Card>
    </div>
  );
}
