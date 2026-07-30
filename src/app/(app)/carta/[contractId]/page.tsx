import Link from "next/link";
import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { Assinaturas, PapelImpresso } from "@/components/papel-impresso";
import { rentUpdateEligibility } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { fmtDate, fmtEur, fmtNum, todayISO } from "@/lib/format";
import type { Contract, Landlord, Property, PropertyOwner, RentUpdate, UpdateCoefficient } from "@/lib/types";

export const dynamic = "force-dynamic";

// A folha A4 e as regras de impressão mudaram-se para `components/papel-impresso.tsx`
// quando as minutas passaram a precisar exatamente das mesmas (2026-07-30).

// Casos de fronteira (contrato inexistente/cessado, sem senhorio, sem coeficiente,
// ainda não elegível): Card com explicação em vez de crashar.
function NaoDisponivel({ propertyId, children }: { propertyId?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        <Link href="/carteira?lente=renda" className="hover:text-teal-700 hover:underline">
          Frações
        </Link>
        {propertyId && (
          <>
            <span className="mx-1.5 text-zinc-300">/</span>
            <Link href={`/fracoes/${propertyId}`} className="hover:text-teal-700 hover:underline">
              Fração
            </Link>
          </>
        )}
        <span className="mx-1.5 text-zinc-300">/</span>
        Carta de atualização de renda
      </p>
      <Card title="Carta de atualização de renda">
        <EmptyState icon={TriangleAlert}>{children}</EmptyState>
      </Card>
    </div>
  );
}

export default async function CartaPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  const { supabase } = await getSession();

  const { data: contractData } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  const contract = contractData as Contract | null;

  if (!contract) {
    return <NaoDisponivel>Este contrato não existe ou foi removido.</NaoDisponivel>;
  }
  if (contract.status !== "ativo") {
    return (
      <NaoDisponivel propertyId={contract.property_id}>
        Este contrato já está cessado. Só é possível gerar carta de atualização de renda para
        contratos ativos.
      </NaoDisponivel>
    );
  }

  const [propQ, ownersQ, landlordsQ, updatesQ, coefficientsQ] = await Promise.all([
    supabase.from("properties").select("*").eq("id", contract.property_id).maybeSingle(),
    supabase.from("property_owners").select("*").eq("property_id", contract.property_id),
    supabase.from("landlords").select("*"),
    supabase
      .from("rent_updates")
      .select("*")
      .eq("contract_id", contract.id)
      .order("effective_date", { ascending: false }),
    supabase.from("update_coefficients").select("*"),
  ]);

  const property = propQ.data as Property | null;
  if (!property) {
    return <NaoDisponivel>Não foi possível encontrar a fração associada a este contrato.</NaoDisponivel>;
  }

  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const landlords = (landlordsQ.data ?? []) as Landlord[];
  const landlordById = new Map(landlords.map((l) => [l.id, l]));
  // Vários proprietários na mesma fração: usa o de maior quota (decisão reportada
  // no relatório final da tarefa — não há regra de desempate além da quota).
  const chosenOwner = owners.slice().sort((a, b) => b.quota - a.quota)[0];
  const landlord = chosenOwner ? landlordById.get(chosenOwner.landlord_id) : undefined;

  if (!landlord) {
    return (
      <NaoDisponivel propertyId={property.id}>
        Esta fração não tem senhorio associado (ou a associação está incompleta). Associa um
        proprietário na ficha da fração antes de gerar a carta.
      </NaoDisponivel>
    );
  }

  const coefficients = (coefficientsQ.data ?? []) as UpdateCoefficient[];
  if (coefficients.length === 0) {
    return (
      <NaoDisponivel propertyId={property.id}>
        Ainda não há nenhum coeficiente de atualização registado. Regista o coeficiente do ano em
        Admin antes de gerar a carta.
      </NaoDisponivel>
    );
  }
  const latestCoef = coefficients.slice().sort((a, b) => b.year - a.year)[0];

  const rentUpdates = (updatesQ.data ?? []) as RentUpdate[];
  const eligibility = rentUpdateEligibility(contract, rentUpdates, coefficients, todayISO());

  if (!eligibility.eligible || eligibility.suggestedRent === null || !eligibility.eligibleSince) {
    return (
      <NaoDisponivel propertyId={property.id}>
        {eligibility.eligibleSince
          ? `Este contrato ainda não é elegível para atualização de renda. Elegível a partir de ${fmtDate(eligibility.eligibleSince)}.`
          : "Não foi possível calcular a elegibilidade deste contrato: falta a data de início ou uma atualização de renda anterior."}
      </NaoDisponivel>
    );
  }

  const fracaoMorada =
    [property.address, property.postal_code, property.parish, property.municipality]
      .filter(Boolean)
      .join(", ") || property.name;
  const fracaoRef = property.address || property.name;
  const contratoRef = contract.pf_contract_no
    ? `, com o n.º ${contract.pf_contract_no} no Portal das Finanças,`
    : "";

  return (
    <PapelImpresso
      migalhas={
        <>
          <Link href="/carteira?lente=renda" className="hover:text-acao hover:underline">
            Frações
          </Link>
          <span className="mx-1.5">/</span>
          <Link href={`/fracoes/${property.id}`} className="hover:text-acao hover:underline">
            {property.name}
          </Link>
          <span className="mx-1.5">/</span>
          Carta de atualização de renda
        </>
      }
    >
        <div>
          <p className="font-semibold">{landlord.name}</p>
          <p className="text-zinc-600">NIF {landlord.nif ?? "n/d"}</p>
        </div>

        <div className="mt-8">
          <p>Ex.mo(a) Senhor(a)</p>
          <p className="font-medium">{contract.tenant_name}</p>
          <p className="text-zinc-600">{fracaoMorada}</p>
        </div>

        <p className="mt-8 font-semibold">Assunto: Atualização da renda referente à fração {fracaoRef}</p>

        <div className="mt-6 space-y-4 leading-relaxed">
          <p>Ex.mo(a) Senhor(a) {contract.tenant_name},</p>
          <p>
            Nos termos do artigo 24.º da Lei n.º 6/2006, de 27 de fevereiro (Novo Regime do
            Arrendamento Urbano), vimos comunicar a atualização anual da renda do contrato de
            arrendamento da fração acima identificada
            {contratoRef} com início em {fmtDate(contract.start_date)}.
          </p>
          <p>
            A renda mensal atualmente em vigor é de <strong>{fmtEur(contract.rent, 2)}</strong>.
          </p>
          <p>
            É aplicado o coeficiente de atualização de renda para o ano de {latestCoef.year}, fixado
            em {fmtNum(latestCoef.coefficient, 4)} e publicado em Diário da República.
          </p>
          <p>
            Em resultado desta atualização, a nova renda mensal passa a ser de{" "}
            <strong>{fmtEur(eligibility.suggestedRent, 2)}</strong>, com efeitos a partir de{" "}
            {fmtDate(eligibility.eligibleSince)}.
          </p>
          <p>Solicita-se a confirmação da receção da presente comunicação.</p>
          <p>Com os melhores cumprimentos,</p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-zinc-500">Local</p>
            <div className="mt-6 h-px w-full bg-zinc-300" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">Data</p>
            <p className="mt-1">{fmtDate(todayISO())}</p>
          </div>
        </div>

        <Assinaturas legendas={["Assinatura do Senhorio"]} />

        <p className="mt-16 text-[10px] leading-snug text-zinc-400">
          Carta gerada automaticamente a partir dos dados do contrato; confirmar o prazo de
          antecedência exigido e o enquadramento legal do contrato específico antes de enviar. Este
          conteúdo não constitui aconselhamento jurídico vinculativo.
        </p>
    </PapelImpresso>
  );
}
